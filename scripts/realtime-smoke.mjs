// Test de fumée temps réel (phase 15, ADR-014), pile LOCALE seulement :
//   supabase start && supabase db reset   # seed requis
//   node scripts/realtime-smoke.mjs
// Prouve : livraison booking_changed < 5 s sur le canal privé du tenant, refus d'un autre tenant, reconnexion.
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout, clearTimeout } from 'node:timers';
import { performance } from 'node:perf_hooks';

const SEED_TENANT = '5750a0b3-4c6c-4782-b137-830a49e32249';
const TENANT_B = '5a0e0000-0000-4000-8000-00000000000b';
const EMAILS = ['smoke-a@local.invalid', 'smoke-b@local.invalid'];
const KEYS = 'driver_id,id,mission_status,status,updated_at';
const t0 = performance.now();

class Fail extends Error {
  constructor(step, msg) {
    super(msg);
    this.step = step;
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. Config : les clés sont lues à l'exécution, jamais affichées ni écrites
const env = {};
for (const line of execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8' }).split('\n')) {
  const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
  if (m) env[m[1]] = m[2];
}
const url = env.API_URL;
const anon = env.ANON_KEY || env.PUBLISHABLE_KEY;
const service = env.SERVICE_ROLE_KEY || env.SECRET_KEY;
let host = '';
try {
  host = new URL(url).hostname;
} catch {
  // URL absente ou illisible : traitée comme non locale
}
if (host !== '127.0.0.1' && host !== 'localhost') {
  console.error('FAIL [local] : URL non locale, arrêt');
  process.exit(2);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: WebSocket } };
const admin = createClient(url, service, opts);
const a = createClient(url, anon, opts);
const b = createClient(url, anon, opts);

function joined(client, topic, received) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ status: 'TIMED_OUT' }), 10000);
    const channel = client.channel(topic, { config: { private: true } });
    channel.on('broadcast', { event: 'booking_changed' }, (m) => received.push(m.payload));
    channel.subscribe((status) => {
      if (['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
        clearTimeout(timer);
        resolve({ status, channel });
      }
    });
  });
}

async function waitFor(predicate, ms) {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    if (predicate()) return true;
    await sleep(100);
  }
  return predicate();
}

async function deleteSmokeUsers() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data?.users ?? []) if (EMAILS.includes(u.email)) await admin.auth.admin.deleteUser(u.id);
}

async function makeUser(email, tenant_id, tenant_role) {
  const password = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Fail('preparation', error.message);
  const up = await admin.from('profiles').update({ tenant_id, tenant_role }).eq('id', data.user.id);
  if (up.error) throw new Fail('preparation', up.error.message);
  return password;
}

async function touch(bookingId) {
  const { error } = await admin
    .from('bookings')
    .update({ mission_note: `smoke ${new Date().toISOString()}` })
    .eq('id', bookingId);
  if (error) throw new Fail('update', error.message);
}

// Attend un payload valide pour la course ; renvoie la latence en ms
async function expectEvent(received, bookingId, step) {
  const start = performance.now();
  await touch(bookingId);
  const ok = await waitFor(() => received.some((p) => p.id === bookingId), 5000);
  if (!ok) throw new Fail(step, 'aucun booking_changed reçu en 5 s');
  const p = received.find((x) => x.id === bookingId);
  if (Object.keys(p).sort().join(',') !== KEYS) throw new Fail(step, `clés inattendues : ${Object.keys(p).sort()}`);
  return Math.round(performance.now() - start);
}

// bookings interdit le DELETE : la course créée ici (pending, sans effet ledger) est réutilisée aux exécutions suivantes
async function ensureBooking() {
  const found = await admin.from('bookings').select('id').eq('current_tenant_id', SEED_TENANT).limit(1).maybeSingle();
  if (found.data) return found.data;
  const cust = await admin
    .from('customers')
    .insert({ tenant_id: SEED_TENANT, email: 'smoke-client@local.invalid', first_name: 'Smoke' })
    .select('id')
    .single();
  if (cust.error) throw new Fail('seed', cust.error.message);
  const ins = await admin
    .from('bookings')
    .insert({
      original_tenant_id: SEED_TENANT,
      current_tenant_id: SEED_TENANT,
      customer_id: cust.data.id,
      status: 'pending',
      payment_mode: 'card',
      pickup_time: new Date(Date.now() + 3 * 86400000).toISOString(),
      mission_status: 'to_validate',
      pickup_address: 'A',
      dropoff_address: 'B',
      total_amount: 100,
      subtotal_amount: 90.91,
      vat_amount: 9.09,
      booking_type: 'transfer',
      booking_source: 'manual_driver',
      pricing_mode: 'direct',
    })
    .select('id')
    .single();
  if (ins.error) throw new Fail('seed', ins.error.message);
  return ins.data;
}

let latence = 0;
let latence2 = 0;
let passed = false;
try {
  // 3. Préparation
  const booking = await ensureBooking();
  const tenantB = await admin
    .from('tenants')
    .upsert({ id: TENANT_B, name: 'Smoke B (local)', primary_domain: 'smoke-b.invalid', legal_form: 'sasu', setup_completed: true });
  if (tenantB.error) throw new Fail('preparation', tenantB.error.message);
  await deleteSmokeUsers();
  const pwA = await makeUser(EMAILS[0], SEED_TENANT, 'manager');
  const pwB = await makeUser(EMAILS[1], TENANT_B, 'owner');

  // 4. Connexion
  for (const [c, email, password] of [
    [a, EMAILS[0], pwA],
    [b, EMAILS[1], pwB],
  ]) {
    const { error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw new Fail('connexion', error.message);
    await c.realtime.setAuth();
  }

  // 6. Assertions
  const topicA = `tenant:${SEED_TENANT}:bookings`;
  const recA = [];
  const recB = [];
  const ja = await joined(a, topicA, recA);
  if (ja.status !== 'SUBSCRIBED') throw new Fail('abonnement', `A : ${ja.status}`);
  const jbBad = await joined(b, topicA, recB);
  if (jbBad.status !== 'CHANNEL_ERROR') throw new Fail('isolement', `B sur le topic de A : ${jbBad.status}`);
  const jbOk = await joined(b, `tenant:${TENANT_B}:bookings`, recB);
  if (jbOk.status !== 'SUBSCRIBED') throw new Fail('abonnement', `B sur son topic : ${jbOk.status}`);

  latence = await expectEvent(recA, booking.id, 'livraison');
  await sleep(2000);
  if (recB.length) throw new Fail('isolement', 'B a reçu un payload');

  // Reconnexion
  await a.removeChannel(ja.channel);
  recA.length = 0;
  const ja2 = await joined(a, topicA, recA);
  if (ja2.status !== 'SUBSCRIBED') throw new Fail('reconnexion', `A : ${ja2.status}`);
  latence2 = await expectEvent(recA, booking.id, 'reconnexion');
  passed = true;
} catch (e) {
  console.error(`FAIL [${e.step ?? 'erreur'}] : ${e.message}`);
  process.exitCode = 1;
} finally {
  await a.removeAllChannels();
  await b.removeAllChannels();
  await deleteSmokeUsers();
  if (passed) {
    const s = ((performance.now() - t0) / 1000).toFixed(1);
    console.log(`Realtime smoke passed in ${s} s (livraison ${latence} ms, reconnexion ${latence2} ms).`);
  }
  process.exit(process.exitCode ?? 0);
}
