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

/** Course + client `e2e-<tag>` (nom surchargeable par `lastName`, à garder préfixé `e2e-<tag>`) dans le tenant du seed. Éviter paid/completed (ledger). */
export async function seedBooking(p: Row & { tag: string; lastName?: string; phone?: string }): Promise<{ id: string }> {
  const { tag, lastName, phone, ...overrides } = p;
  const db = admin();
  const { data: customer, error: ce } = await db
    .from('customers')
    .insert({ tenant_id: TENANT_ID, email: `e2e-${tag}@local.test`, first_name: 'E2E', last_name: lastName ?? `e2e-${tag}`, phone: phone ?? null })
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

/** Change le statut du tenant du seed (kill switch plateforme) ; rétablir à 'active' après usage. */
export async function setTenantStatus(status: 'active' | 'suspended'): Promise<void> {
  const { error } = await admin().from('tenants').update({ status } as never).eq('id', TENANT_ID);
  if (error) throw new Error(`setTenantStatus : ${error.message}`);
}

const SEED_PLATE = 'AA-001-AA';

/** Remet les véhicules du seed : supprime les plaques `E2E-*`, réactive le véhicule du seed (un seul actif). */
export async function resetVehicles(): Promise<void> {
  const db = admin();
  const del = await db.from('vehicles').delete().eq('tenant_id', TENANT_ID).like('plate_number', 'E2E-%');
  if (del.error) throw new Error(`resetVehicles : ${del.error.message}`);
  const off = await db.from('vehicles').update({ status: 'inactive' } as never).eq('tenant_id', TENANT_ID);
  if (off.error) throw new Error(`resetVehicles : ${off.error.message}`);
  const on = await db.from('vehicles').update({ status: 'active' } as never).eq('tenant_id', TENANT_ID).eq('plate_number', SEED_PLATE);
  if (on.error) throw new Error(`resetVehicles : ${on.error.message}`);
}

export async function seedVehicle(plate: string, model: string, status: 'active' | 'inactive' = 'inactive'): Promise<void> {
  const { error } = await admin().from('vehicles').insert({ tenant_id: TENANT_ID, brand: 'E2E', model, plate_number: plate, category: 'berline', capacity: 4, status } as never);
  if (error) throw new Error(`seedVehicle : ${error.message}`);
}

export async function vehicleStatuses(): Promise<Record<string, string>> {
  const { data, error } = await admin().from('vehicles').select('plate_number, status').eq('tenant_id', TENANT_ID);
  if (error) throw new Error(`vehicleStatuses : ${error.message}`);
  return Object.fromEntries(data.map((v) => [v.plate_number, v.status]));
}

/** Téléphone d'une fiche chauffeur (lecture ou remise à l'état du seed). */
export async function driverPhone(lastName: string, set?: string): Promise<string | null> {
  const db = admin();
  if (set !== undefined) {
    const { error } = await db.from('drivers').update({ phone: set } as never).eq('tenant_id', TENANT_ID).eq('last_name', lastName);
    if (error) throw new Error(`driverPhone : ${error.message}`);
  }
  const { data, error } = await db.from('drivers').select('phone').eq('tenant_id', TENANT_ID).eq('last_name', lastName).single();
  if (error) throw new Error(`driverPhone : ${error.message}`);
  return data.phone;
}
