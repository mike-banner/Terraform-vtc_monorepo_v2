// Données de test pour la base LOCALE (service_role, jamais importé hors tests/).
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import ws from 'ws';
import '../e2e-env';

export const TENANT_ID = '5750a0b3-4c6c-4782-b137-830a49e32249';
const DB_URL = process.env.E2E_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const admin = () =>
  createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    realtime: { transport: ws as any }, // Node 20 sans WebSocket natif
  });

type Row = Record<string, unknown>;

/** Course + client `e2e-<tag>` dans le tenant du seed. Éviter paid/completed (ledger). */
export async function seedBooking(p: Row & { tag: string }): Promise<{ id: string }> {
  const { tag, ...overrides } = p;
  const db = admin();
  const { data: customer, error: ce } = await db
    .from('customers')
    .insert({ tenant_id: TENANT_ID, email: `e2e-${tag}@local.test`, first_name: 'E2E', last_name: `e2e-${tag}` })
    .select('id')
    .single();
  if (ce) throw new Error(`seedBooking client : ${ce.message}`);
  const { data, error } = await db
    .from('bookings')
    .insert({
      original_tenant_id: TENANT_ID,
      current_tenant_id: TENANT_ID,
      customer_id: customer.id,
      status: 'pending',
      mission_status: 'to_validate',
      payment_mode: 'cash',
      pickup_time: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      pickup_address: 'Départ e2e',
      dropoff_address: 'Arrivée e2e',
      total_amount: 100,
      subtotal_amount: 90.91,
      vat_amount: 9.09,
      booking_type: 'transfer',
      booking_source: 'manual_driver',
      pricing_mode: 'direct',
      ...overrides,
    } as never)
    .select('id')
    .single();
  if (error) throw new Error(`seedBooking course : ${error.message}`);
  return { id: data.id };
}

/** Écriture « ailleurs » (tests temps réel). */
export async function updateBooking(id: string, patch: Row): Promise<void> {
  const { error } = await admin().from('bookings').update(patch as never).eq('id', id);
  if (error) throw new Error(`updateBooking : ${error.message}`);
}

/**
 * Supprime les courses puis les clients `e2e-<tag>`. Le trigger anti-suppression des
 * courses est levé le temps de la transaction (base locale, droits propriétaire).
 */
export function cleanupByPrefix(tag: string): void {
  if (!/^[\w-]+$/.test(tag)) throw new Error('cleanupByPrefix : tag invalide');
  const like = `e2e-${tag}%`;
  execFileSync(
    'psql',
    [DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-c', `
      begin;
      alter table public.bookings disable trigger trg_prevent_booking_delete;
      delete from public.bookings where customer_id in (select id from public.customers where last_name like '${like}');
      alter table public.bookings enable trigger trg_prevent_booking_delete;
      delete from public.customers where last_name like '${like}';
      commit;`],
    { stdio: 'pipe' },
  );
}
