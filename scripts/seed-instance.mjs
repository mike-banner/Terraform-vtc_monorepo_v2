#!/usr/bin/env node
// Crée (ou réutilise) le tenant d'un site et son propriétaire sur une instance.
// Un appel = un tenant = un site (D-30) : sert à l'installation comme à l'ajout d'un site.
// Aucun mot de passe : le propriétaire reçoit une invitation par e-mail.
// Les tarifs de départ viennent de l'assistant /app/setup, la politique d'annulation du trigger.
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

// Node 20 n'a pas de WebSocket natif (même polyfill que seed-demo-account.ts)
globalThis.WebSocket ??= ws;

const REQUIS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OWNER_EMAIL', 'TENANT_NAME', 'TENANT_DOMAIN', 'BACKOFFICE_URL'];
const manquantes = REQUIS.filter((k) => !process.env[k]);
if (manquantes.length) {
  console.error(`Variables manquantes : ${manquantes.join(' ')}`);
  process.exit(1);
}
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OWNER_EMAIL, TENANT_NAME, TENANT_DOMAIN, BACKOFFICE_URL } = process.env;

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function fail(msg) {
  console.error(msg);
  process.exit(1);
}
function ok(r, ctx) {
  if (r.error) fail(`${ctx} : ${r.error.message}`);
  return r.data;
}

// ponytail: une seule page de 1000 comptes, suffisant pour une instance ; paginer si besoin
async function findUser(email) {
  const { users } = ok(await db.auth.admin.listUsers({ page: 1, perPage: 1000 }), 'listUsers');
  return users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
}

const user = await findUser(OWNER_EMAIL);
const tenant = ok(
  await db.from('tenants').select('id').eq('primary_domain', TENANT_DOMAIN).maybeSingle(),
  'lecture du tenant',
);

// Garde (a) : domaine déjà pris par le tenant d'un autre propriétaire
if (tenant) {
  const owner = ok(
    await db.from('profiles').select('id').eq('tenant_id', tenant.id).eq('tenant_role', 'owner').maybeSingle(),
    'lecture du propriétaire',
  );
  if (owner && owner.id !== user?.id) fail('Domaine déjà pris par un autre tenant');
}
// Garde (b) : propriétaire déjà rattaché à un autre tenant (profiles.tenant_id est unique par compte)
if (user) {
  const p = ok(await db.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle(), 'lecture du profil');
  if (p?.tenant_id && p.tenant_id !== tenant?.id) {
    fail('Ce propriétaire appartient déjà à un autre tenant (un compte par tenant : utiliser une autre adresse)');
  }
}

const tenantId =
  tenant?.id ??
  ok(
    await db
      .from('tenants')
      .insert({ name: TENANT_NAME, primary_domain: TENANT_DOMAIN, setup_completed: false })
      .select('id')
      .single(),
    'création du tenant',
  ).id;
console.log('tenant prêt');

let ownerId = user?.id;
if (!ownerId) {
  const invited = ok(await db.auth.admin.inviteUserByEmail(OWNER_EMAIL, { redirectTo: BACKOFFICE_URL }), 'invitation');
  ownerId = invited.user.id;
  console.log('invitation envoyée');
}
// handle_new_user crée la ligne profiles ; on la rattache au tenant
ok(await db.from('profiles').update({ tenant_id: tenantId, tenant_role: 'owner' }).eq('id', ownerId), 'rattachement');

const { count, error } = await db
  .from('cancellation_policies')
  .select('id', { count: 'exact', head: true })
  .eq('tenant_id', tenantId)
  .eq('active', true);
if (error) fail(`politique d'annulation : ${error.message}`);
if (count !== 1) fail(`Politique d'annulation active attendue : 1, trouvée : ${count}`);

console.log(`TENANT_ID=${tenantId}`);
