// Écran Analytics de superadmin (Phase 4.5) et exactitude de platform_tenant_analytics.
//
// Les agrégats de la fonction (appelée avec le JWT d'un admin plateforme) sont comparés à un
// calcul indépendant fait ici en service_role sur la même période. Admin jetable créé en
// beforeAll, supprimé en afterAll. Cible : voir tests/e2e-env.ts.
import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
import './e2e-env';

const stamp = Date.now();
const password = `E2e-${stamp}-Pw!`;
const adminEmail = `e2e-analytics-${stamp}@test.invalid`;

let service: SupabaseClient;
let adminId: string;

const clientOptions = { auth: { persistSession: false }, realtime: { transport: ws as never } };

test.beforeAll(async () => {
  service = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, clientOptions);
  const { data, error } = await service.auth.admin.createUser({ email: adminEmail, password, email_confirm: true });
  expect(error).toBeNull();
  adminId = data.user!.id;
  const { error: roleError } = await service
    .from('profiles')
    .update({ platform_role: 'super_admin', tenant_role: null })
    .eq('id', adminId);
  expect(roleError).toBeNull();
});

test.afterAll(async () => {
  if (adminId) await service.auth.admin.deleteUser(adminId);
});

test('les agrégats de platform_tenant_analytics correspondent au ledger', async () => {
  const admin = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.PUBLIC_SUPABASE_ANON_KEY!, clientOptions);
  const { error: loginError } = await admin.auth.signInWithPassword({ email: adminEmail, password });
  expect(loginError).toBeNull();

  const from = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
  const to = new Date(Date.now() + 1000).toISOString();

  const { data: rows, error } = await admin.rpc('platform_tenant_analytics', { p_from: from, p_to: to });
  expect(error).toBeNull();
  const total = rows.find((r: { tenant_id: string | null }) => r.tenant_id === null);
  expect(total).toBeTruthy();

  const { data: movements } = await service
    .from('financial_movements')
    .select('movement_type, direction, gross_amount')
    .gte('created_at', from)
    .lt('created_at', to);
  const sum = (type: string, dir: string) =>
    (movements ?? [])
      .filter((m) => m.movement_type === type && m.direction === dir)
      .reduce((acc, m) => acc + Number(m.gross_amount), 0);

  expect(Number(total.collected_gross)).toBeCloseTo(sum('payment', 'credit'), 2);
  expect(Number(total.refunded_gross)).toBeCloseTo(sum('refund', 'debit'), 2);

  const { count: bookings } = await service
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', from)
    .lt('created_at', to);
  expect(Number(total.bookings_count)).toBe(bookings);

  // Un compte non plateforme est refusé.
  await admin.auth.signOut();
  const anon = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.PUBLIC_SUPABASE_ANON_KEY!, clientOptions);
  const { error: anonError } = await anon.rpc('platform_tenant_analytics', { p_from: from, p_to: to });
  expect(anonError).not.toBeNull();
});

test("l'écran Analytics affiche les tenants et les indicateurs", async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', adminEmail);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page.getByText('Liste des Entreprises')).toBeVisible();

  await page.getByRole('link', { name: 'Analytics' }).click();
  await expect(page.getByRole('heading', { name: 'Analytics plateforme' })).toBeVisible();
  await page.getByLabel('Période').selectOption('12m');

  await expect(page.getByText('CA brut (TTC)')).toBeVisible();
  const { count: tenants } = await service.from('tenants').select('id', { count: 'exact', head: true });
  await expect(page.locator('tbody tr')).toHaveCount(tenants!);
  await expect(page.getByText(/^Erreur :/)).toHaveCount(0);
});
