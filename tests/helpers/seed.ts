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

/** Compte Stripe du tenant : null = jamais connecté (état du seed). */
export async function setStripeAccount(id: string | null): Promise<void> {
  const { error } = await admin().from('tenants').update({ stripe_account_id: id } as never).eq('id', TENANT_ID);
  if (error) throw new Error(`setStripeAccount : ${error.message}`);
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

/** Supprime les tarifs créés par les tests (service `E2E…`). */
export async function resetPricing(): Promise<void> {
  const { error } = await admin().from('pricing_rules').delete().eq('tenant_id', TENANT_ID).like('service_category', 'E2E%');
  if (error) throw new Error(`resetPricing : ${error.message}`);
}

export async function pricingRule(category: string): Promise<Row | null> {
  const { data, error } = await admin().from('pricing_rules').select('*').eq('tenant_id', TENANT_ID).eq('service_category', category).maybeSingle();
  if (error) throw new Error(`pricingRule : ${error.message}`);
  return data as Row | null;
}

export async function activePolicy(): Promise<Row> {
  const { data, error } = await admin().from('cancellation_policies').select('*').eq('tenant_id', TENANT_ID).eq('active', true).single();
  if (error) throw new Error(`activePolicy : ${error.message}`);
  return data as Row;
}

/** Réactive la version `id` de la politique et supprime les versions créées depuis (aucune course ne les référence). */
export async function restorePolicy(id: string): Promise<void> {
  const db = admin();
  const off = await db.from('cancellation_policies').update({ active: false } as never).eq('tenant_id', TENANT_ID).neq('id', id);
  if (off.error) throw new Error(`restorePolicy : ${off.error.message}`);
  const on = await db.from('cancellation_policies').update({ active: true } as never).eq('id', id);
  if (on.error) throw new Error(`restorePolicy : ${on.error.message}`);
  await db.from('cancellation_policies').delete().eq('tenant_id', TENANT_ID).neq('id', id);
}

const TENANT_COLS = 'legal_form, vat_number, is_vat_exempt, vat_rate, address_line, postal_code, city, logo_url';

/** Lecture des réglages du tenant ; `restore` remet un instantané (la TVA se redérive par le trigger). */
export async function tenantSettingsRow(): Promise<Row> {
  const { data, error } = await admin().from('tenants').select(TENANT_COLS).eq('id', TENANT_ID).single();
  if (error) throw new Error(`tenantSettingsRow : ${error.message}`);
  return data as Row;
}

export async function restoreTenantSettings(snap: Row): Promise<void> {
  const { legal_form, vat_number, address_line, postal_code, city, logo_url } = snap;
  const { error } = await admin().from('tenants').update({ legal_form, vat_number, address_line, postal_code, city, logo_url } as never).eq('id', TENANT_ID);
  if (error) throw new Error(`restoreTenantSettings : ${error.message}`);
}

const LEDGER_EVENT = 'e2e-ledger';
const LEDGER_BOOKING = '77777777-7777-7777-7777-777777777772'; // course payée 100 € du seed

/** Mouvement du grand livre `e2e-ledger` sur une course du seed (service_role : seul INSERT autorisé). */
export async function seedLedgerMovement(type: 'payment' | 'refund', createdAt: string, gross: number, net: number, vat: number): Promise<void> {
  const { error } = await admin().from('financial_movements').insert({
    booking_id: LEDGER_BOOKING, tenant_id: TENANT_ID, movement_type: type, direction: type === 'payment' ? 'credit' : 'debit',
    gross_amount: gross, net_amount: net, vat_amount: vat, created_at: createdAt, created_by_event: LEDGER_EVENT,
  } as never);
  if (error) throw new Error(`seedLedgerMovement : ${error.message}`);
}

/** Retire les mouvements `e2e-ledger` (ledger immuable : suppression par la connexion propriétaire, base locale). */
export function resetLedgerMovements(): void {
  execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-c', `delete from public.financial_movements where created_by_event = '${LEDGER_EVENT}'`], { stdio: 'pipe' });
}

/** SIRET du tenant du seed (requis par l'export FEC) ; renvoie l'ancienne valeur pour la restaurer. */
export async function setTenantSiret(siret: string | null): Promise<string | null> {
  const db = admin();
  const { data, error } = await db.from('tenants').select('siret').eq('id', TENANT_ID).single();
  if (error) throw new Error(`setTenantSiret : ${error.message}`);
  const { error: e2 } = await db.from('tenants').update({ siret } as never).eq('id', TENANT_ID);
  if (e2) throw new Error(`setTenantSiret : ${e2.message}`);
  return data.siret;
}

const OWNER_ID = '11111111-1111-1111-1111-111111111111';
const SETUP_COLS = 'setup_completed, siret, rcs_number, capital_social, vat_number, legal_form';
export type SetupSnapshot = { tenant: Row; license: string | null; vehicles: string[]; rules: string[] };

/** Remet le tenant du seed à l'état « non configuré » (première connexion) ; renvoie l'instantané pour `restoreSetup`. */
export async function unconfigureTenant(): Promise<SetupSnapshot> {
  const db = admin();
  const { data: tenant, error } = await db.from('tenants').select(SETUP_COLS).eq('id', TENANT_ID).single();
  if (error) throw new Error(`unconfigureTenant : ${error.message}`);
  const { data: drv } = await db.from('drivers').select('license_number').eq('user_id', OWNER_ID).maybeSingle();
  const { data: veh } = await db.from('vehicles').select('id').eq('tenant_id', TENANT_ID).eq('status', 'active');
  const { data: rules } = await db.from('pricing_rules').select('id').eq('tenant_id', TENANT_ID).eq('active', true);
  const snap: SetupSnapshot = { tenant: tenant as Row, license: drv?.license_number ?? null, vehicles: (veh ?? []).map((v) => v.id), rules: (rules ?? []).map((r) => r.id) };
  const steps = await Promise.all([
    db.from('vehicles').update({ status: 'inactive' } as never).eq('tenant_id', TENANT_ID),
    db.from('pricing_rules').update({ active: false } as never).eq('tenant_id', TENANT_ID),
    db.from('tenants').update({ setup_completed: false, siret: null } as never).eq('id', TENANT_ID),
  ]);
  for (const s of steps) if (s.error) throw new Error(`unconfigureTenant : ${s.error.message}`);
  return snap;
}

/** Rétablit l'état d'avant `unconfigureTenant` et supprime ce que les tests ont créé (plaques `E2E-`, services `E2E`). */
export async function restoreSetup(snap: SetupSnapshot): Promise<void> {
  const db = admin();
  await db.from('vehicles').delete().eq('tenant_id', TENANT_ID).like('plate_number', 'E2E-%');
  await db.from('pricing_rules').delete().eq('tenant_id', TENANT_ID).like('service_category', 'E2E%');
  if (snap.vehicles.length) await db.from('vehicles').update({ status: 'active' } as never).in('id', snap.vehicles);
  if (snap.rules.length) await db.from('pricing_rules').update({ active: true } as never).in('id', snap.rules);
  const { error } = await db.from('tenants').update(snap.tenant as never).eq('id', TENANT_ID);
  if (error) throw new Error(`restoreSetup : ${error.message}`);
  if (snap.license !== null) await db.from('drivers').update({ license_number: snap.license } as never).eq('user_id', OWNER_ID);
}

export async function tenantSetupRow(): Promise<Row> {
  const { data, error } = await admin().from('tenants').select(SETUP_COLS).eq('id', TENANT_ID).single();
  if (error) throw new Error(`tenantSetupRow : ${error.message}`);
  return data as Row;
}

/** Identifiant d'un véhicule du tenant du seed (course éditable avec aperçu de prix). */
export async function firstVehicleId(): Promise<string> {
  const { data, error } = await admin().from('vehicles').select('id').eq('tenant_id', TENANT_ID).order('created_at').limit(1).single();
  if (error) throw new Error(`firstVehicleId : ${error.message}`);
  return data.id;
}

/** Purge des courses et mouvements d'un tenant jetable (base locale, triggers d'immuabilité levés le temps de la transaction). */
export function purgeTenantBookings(tenantId: string): void {
  if (!/^[0-9a-f-]{36}$/.test(tenantId)) throw new Error('purgeTenantBookings : identifiant invalide');
  execFileSync(
    'psql',
    [DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-c', `
      begin;
      set local session_replication_role = replica;
      delete from public.financial_movements where tenant_id = '${tenantId}';
      delete from public.bookings where current_tenant_id = '${tenantId}';
      commit;`],
    { stdio: 'pipe' },
  );
}
