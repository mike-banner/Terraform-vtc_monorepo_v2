// Cible Supabase des tests E2E qui écrivent en base.
//
// Par défaut : la stack locale, décrite dans `.env.e2e` (voir `.env.e2e.example`).
// Viser un autre projet exige E2E_ALLOW_PRODUCTION=1 : jusqu'au 2026-09-27 les tests
// lisaient `.env` (production) et y avaient laissé 13 tenants et 12 courses de test.
import dotenv from 'dotenv';

dotenv.config({ path: process.env.E2E_ENV_FILE ?? '.env.e2e' });

const url = process.env.PUBLIC_SUPABASE_URL ?? '';
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url);

if (!url) {
  throw new Error('E2E : PUBLIC_SUPABASE_URL absent. Créer .env.e2e à partir de .env.e2e.example.');
}
if (!isLocal && process.env.E2E_ALLOW_PRODUCTION !== '1') {
  throw new Error(
    `E2E : la cible ${url} n'est pas locale. Pour écrire dans ce projet, ` +
      'relancer avec E2E_ALLOW_PRODUCTION=1 (et E2E_ENV_FILE=.env si besoin).',
  );
}
