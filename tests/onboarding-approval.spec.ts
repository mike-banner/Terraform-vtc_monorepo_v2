// Rejoue une approbation d'onboarding réelle depuis apps/superadmin (Phase 11).
//
// Contrairement à backoffice.spec.ts, qui insère lui-même tenant/profil/driver en
// service_role, ce test passe par le vrai bouton « Approuver », donc par
// approve_onboarding_tx avec le JWT d'un admin plateforme. C'est ce chemin qui était
// cassé du 2026-05-31 au 2026-09-26 sans qu'aucun test ne le voie.
//
// Cible : voir tests/e2e-env.ts (base locale par défaut). Tous les comptes créés sont
// supprimés en afterAll, même en cas d'échec ; les suppressions partent en cascade de
// auth.users (profil, dossier) et de tenants (driver).
import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
import './e2e-env';

const stamp = Date.now();
const password = `E2e-${stamp}-Pw!`;
const adminEmail = `e2e-superadmin-${stamp}@test.invalid`;
const ownerEmail = `e2e-owner-${stamp}@test.invalid`;
const siret = `9${String(stamp).slice(-13)}`;
const companyName = `E2E Approval SASU ${stamp}`;

let supabase: SupabaseClient;
const userIds: string[] = [];
let ownerId: string;

test.beforeAll(async () => {
  supabase = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
    realtime: { transport: ws as never },
  });

  const admin = await supabase.auth.admin.createUser({ email: adminEmail, password, email_confirm: true });
  expect(admin.error).toBeNull();
  userIds.push(admin.data.user!.id);
  // profiles_single_role_type : un admin plateforme n'a pas de tenant_role.
  const { error: roleError } = await supabase
    .from('profiles')
    .update({ platform_role: 'super_admin', tenant_role: null })
    .eq('id', admin.data.user!.id);
  expect(roleError).toBeNull();

  const owner = await supabase.auth.admin.createUser({ email: ownerEmail, password, email_confirm: true });
  expect(owner.error).toBeNull();
  ownerId = owner.data.user!.id;
  userIds.push(ownerId);
  const { error: obError } = await supabase.from('onboarding').insert({
    profile_id: ownerId,
    first_name: 'Play',
    last_name: 'Wright',
    company_name: companyName,
    primary_domain: `e2e-approval-${stamp}`,
    phone: '+33600000000',
    siret,
    vtc_license_number: String(stamp).slice(-10),
    legal_form: 'sasu',
    status: 'pending',
  });
  expect(obError).toBeNull();
});

test.afterAll(async () => {
  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', ownerId).maybeSingle();
  if (profile?.tenant_id) {
    await supabase.from('tenants').delete().eq('id', profile.tenant_id);
  }
  for (const id of userIds) {
    await supabase.auth.admin.deleteUser(id);
  }
});

test('un admin plateforme approuve un dossier SASU depuis superadmin', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());

  await page.goto('/login');
  await page.fill('input[type="email"]', adminEmail);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page.getByText('Liste des Entreprises')).toBeVisible();

  await page.getByRole('link', { name: 'Onboardings' }).click();
  const row = page.locator('tr', { hasText: companyName });
  await expect(row).toBeVisible();

  await row.getByRole('button', { name: 'Approuver' }).click();
  await expect(row).toHaveCount(0);

  const { data: onboarding } = await supabase.from('onboarding').select('status').eq('profile_id', ownerId).single();
  expect(onboarding?.status).toBe('approved');

  const { data: profile } = await supabase.from('profiles').select('tenant_id, tenant_role').eq('id', ownerId).single();
  expect(profile?.tenant_role).toBe('owner');
  expect(profile?.tenant_id).toBeTruthy();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('legal_form, company_type, siret, is_vat_exempt, vat_rate, setup_completed')
    .eq('id', profile!.tenant_id!)
    .single();
  expect(tenant).toEqual({
    legal_form: 'sasu',
    company_type: 'societe',
    siret,
    is_vat_exempt: false,
    vat_rate: 10,
    setup_completed: false,
  });

  const { data: drivers } = await supabase.from('drivers').select('id').eq('tenant_id', profile!.tenant_id!).eq('user_id', ownerId);
  expect(drivers).toHaveLength(1);
});
