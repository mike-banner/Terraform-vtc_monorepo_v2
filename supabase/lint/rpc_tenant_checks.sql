-- RPC owner sur tenants (Phase 14, D-11 / D-12) : update_tenant_logo, update_tenant_settings,
-- complete_tenant_setup. Exécuté en CI sur une base reconstruite, transaction annulée.

\set ON_ERROR_STOP on
\o /dev/null

BEGIN;

\ir _rpc_fixtures.sql

-- Échec attendu avec SQLSTATE + message exact.
CREATE FUNCTION pg_temp.expect_error(label text, stmt text, code text, msg text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = code AND SQLERRM = msg THEN RETURN; END IF;
    RAISE EXCEPTION 'FAIL [%] : % / "%" attendu, % / "%" obtenu', label, code, msg, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'FAIL [%] : erreur % attendue, instruction acceptée', label, code;
END $$;

-- Valeur scalaire attendue (comparaison texte, NULL compris).
CREATE FUNCTION pg_temp.expect_val(label text, query text, expected text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  EXECUTE query INTO v;
  IF v IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'FAIL [%] : % attendu, % obtenu', label, coalesce(expected, 'NULL'), coalesce(v, 'NULL');
  END IF;
END $$;

-- ============================ LOGO ============================================
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');  -- owner A

SELECT pg_temp.expect_ok('logo: URL prod',
  $q$select public.update_tenant_logo('https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/assets/logos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/logo.png?t=1727600000000')$q$);
SELECT pg_temp.expect_val('logo: écrit', $q$select logo_url from public.tenants where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$,
  'https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/assets/logos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/logo.png?t=1727600000000');
SELECT pg_temp.expect_ok('logo: URL locale',
  $q$select public.update_tenant_logo('http://127.0.0.1:54321/storage/v1/object/public/assets/logos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/logo.webp')$q$);
SELECT pg_temp.expect_error('logo: autre tenant',
  $q$select public.update_tenant_logo('https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/assets/logos/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/logo.png')$q$, '22023', 'URL de logo invalide');
SELECT pg_temp.expect_error('logo: hôte externe',
  $q$select public.update_tenant_logo('https://evil.example/logo.png')$q$, '22023', 'URL de logo invalide');
SELECT pg_temp.expect_error('logo: autre dossier',
  $q$select public.update_tenant_logo('https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/assets/other/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/logo.png')$q$, '22023', 'URL de logo invalide');

SELECT pg_temp.login('22222222-2222-4222-8222-222222222222');  -- manager A
SELECT pg_temp.expect_sqlstate('logo: manager', $q$select public.update_tenant_logo('http://127.0.0.1:54321/storage/v1/object/public/assets/logos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/logo.png')$q$, '42501');
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');  -- driver1
SELECT pg_temp.expect_sqlstate('logo: driver', $q$select public.update_tenant_logo('http://127.0.0.1:54321/storage/v1/object/public/assets/logos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/logo.png')$q$, '42501');
SELECT pg_temp.login('55555555-5555-4555-8555-555555555555');  -- owner B, URL du tenant A
SELECT pg_temp.expect_error('logo: owner B vers dossier A',
  $q$select public.update_tenant_logo('http://127.0.0.1:54321/storage/v1/object/public/assets/logos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/logo.png')$q$, '22023', 'URL de logo invalide');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT pg_temp.expect_sqlstate('logo: anon', $q$select public.update_tenant_logo('http://127.0.0.1:54321/storage/v1/object/public/assets/logos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/logo.png')$q$, '42501');
RESET ROLE;

-- ============================ SETTINGS ========================================
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT public.update_tenant_settings('auto_entrepreneur', 'FR123');
RESET ROLE;
SELECT pg_temp.expect_val('settings: AE exonéré', $q$select is_vat_exempt::text from public.tenants where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, 'true');
SELECT pg_temp.expect_val('settings: AE taux 0', $q$select vat_rate::text from public.tenants where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, '0');
SELECT pg_temp.expect_val('settings: AE vat_number NULL', $q$select vat_number from public.tenants where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, NULL);

SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT public.update_tenant_settings('sasu', 'FR456');
RESET ROLE;
SELECT pg_temp.expect_val('settings: sasu assujetti', $q$select is_vat_exempt::text from public.tenants where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, 'false');
SELECT pg_temp.expect_val('settings: sasu taux 10', $q$select vat_rate::text from public.tenants where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, '10');
SELECT pg_temp.expect_val('settings: sasu vat_number', $q$select vat_number from public.tenants where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, 'FR456');

-- Taux manuel conservé.
UPDATE public.tenants SET vat_rate = 20 WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT public.update_tenant_settings('sarl', 'FR456');
RESET ROLE;
SELECT pg_temp.expect_val('settings: taux 20 conservé', $q$select vat_rate::text from public.tenants where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, '20');

SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_error('settings: forme inconnue', $q$select public.update_tenant_settings('foo', null)$q$, '22023', 'Forme juridique invalide');
SELECT pg_temp.login('22222222-2222-4222-8222-222222222222');
SELECT pg_temp.expect_sqlstate('settings: manager', $q$select public.update_tenant_settings('sasu', null)$q$, '42501');
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_sqlstate('settings: driver', $q$select public.update_tenant_settings('sasu', null)$q$, '42501');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT pg_temp.expect_sqlstate('settings: anon', $q$select public.update_tenant_settings('sasu', null)$q$, '42501');
RESET ROLE;

-- ============================ ONBOARDING ======================================
\set legal '''{"legal_form":"sasu","siret":"12345678901234","rcs_number":"RCS Lyon 123","capital_social":1000,"vat_number":"FR99","vtc_license_number":"EVTC0001","is_vat_exempt":true,"name":"HACK","stripe_account_id":"acct_hack","platform_fee_rate":0,"status":"suspended"}'''
\set vehicle '''{"brand":"Mercedes","model":"Classe E","plate_number":"SET-001-AA","category":"van","capacity":"4","luggage_capacity":"3","is_primary_driver":true}'''
\set pricing '''{"base_price":"15","price_per_km":"2.5","price_per_minute":"0.5","minimum_fare":"45"}'''

-- Déjà configuré (fixture).
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_error('setup: déjà fait', format($q$select public.complete_tenant_setup(%L::jsonb, %L::jsonb, %L::jsonb)$q$, :legal, :vehicle, :pricing), '42501', 'Configuration déjà effectuée');
RESET ROLE;

UPDATE public.tenants SET setup_completed = false WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

SET LOCAL ROLE authenticated;
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_sqlstate('setup: driver', format($q$select public.complete_tenant_setup(%L::jsonb, %L::jsonb, %L::jsonb)$q$, :legal, :vehicle, :pricing), '42501');
SELECT pg_temp.login('22222222-2222-4222-8222-222222222222');
SELECT pg_temp.expect_sqlstate('setup: manager', format($q$select public.complete_tenant_setup(%L::jsonb, %L::jsonb, %L::jsonb)$q$, :legal, :vehicle, :pricing), '42501');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT pg_temp.expect_sqlstate('setup: anon', format($q$select public.complete_tenant_setup(%L::jsonb, %L::jsonb, %L::jsonb)$q$, :legal, :vehicle, :pricing), '42501');
RESET ROLE;

-- Validations (rien ne doit être écrit).
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_error('setup: catégorie business (atomicité)',
  format($q$select public.complete_tenant_setup(%L::jsonb, %L::jsonb, %L::jsonb)$q$, :legal, replace(:vehicle, '"van"', '"business"'), :pricing), '22023', 'Catégorie de véhicule invalide');
SELECT pg_temp.expect_error('setup: siret court',
  format($q$select public.complete_tenant_setup(%L::jsonb, %L::jsonb, %L::jsonb)$q$, replace(:legal, '12345678901234', '123'), :vehicle, :pricing), '22023', 'SIRET invalide');
SELECT pg_temp.expect_error('setup: carte VTC absente',
  format($q$select public.complete_tenant_setup(%L::jsonb, %L::jsonb, %L::jsonb)$q$, replace(:legal, 'EVTC0001', ''), :vehicle, :pricing), '22023', 'Numéro de carte VTC requis');
SELECT pg_temp.expect_error('setup: tarif négatif',
  format($q$select public.complete_tenant_setup(%L::jsonb, %L::jsonb, %L::jsonb)$q$, :legal, :vehicle, replace(:pricing, '"15"', '"-1"')), '22023', 'Tarif invalide');
RESET ROLE;
SELECT pg_temp.expect_val('atomicité: setup_completed', $q$select setup_completed::text from public.tenants where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, 'false');
SELECT pg_temp.expect_val('atomicité: license', $q$select license_number from public.drivers where id = 'd0000000-0000-4000-8000-000000000000'$q$, 'RPC000000000');
SELECT pg_temp.expect_count('atomicité: véhicule', $q$select count(*) from public.vehicles where plate_number = 'SET-001-AA'$q$, 0);
SELECT pg_temp.expect_count('atomicité: règle van', $q$select count(*) from public.pricing_rules where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and service_category = 'van'$q$, 0);

-- Cas nominal avec clés hostiles.
UPDATE public.tenants SET vat_rate = 10, is_vat_exempt = false WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT public.complete_tenant_setup(:legal::jsonb, :vehicle::jsonb, :pricing::jsonb);
RESET ROLE;
SELECT pg_temp.expect_val('setup: setup_completed', $q$select setup_completed::text from public.tenants where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, 'true');
SELECT pg_temp.expect_val('setup: siret', $q$select siret from public.tenants where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, '12345678901234');
SELECT pg_temp.expect_val('setup: rcs', $q$select rcs_number from public.tenants where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, 'RCS Lyon 123');
SELECT pg_temp.expect_val('setup: capital', $q$select capital_social::text from public.tenants where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, '1000');
SELECT pg_temp.expect_val('setup: vat_number', $q$select vat_number from public.tenants where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, 'FR99');
SELECT pg_temp.expect_val('setup: name inchangé', $q$select name from public.tenants where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, 'RPC Test A');
SELECT pg_temp.expect_val('setup: stripe_account_id', $q$select stripe_account_id from public.tenants where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, NULL);
SELECT pg_temp.expect_val('setup: platform_fee_rate inchangé', $q$select (platform_fee_rate = (select platform_fee_rate from public.tenants where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'))::text from public.tenants where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, 'true');
SELECT pg_temp.expect_val('setup: status inchangé', $q$select status::text from public.tenants where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, (select status::text from public.tenants where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'));
SELECT pg_temp.expect_val('setup: is_vat_exempt', $q$select is_vat_exempt::text from public.tenants where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, 'false');
SELECT pg_temp.expect_val('setup: license d0', $q$select license_number from public.drivers where id = 'd0000000-0000-4000-8000-000000000000'$q$, 'EVTC0001');
SELECT pg_temp.expect_count('setup: véhicule d0', $q$select count(*) from public.vehicles where plate_number = 'SET-001-AA' and driver_id = 'd0000000-0000-4000-8000-000000000000' and category = 'van' and capacity = 4 and luggage_capacity = 3$q$, 1);
SELECT pg_temp.expect_count('setup: règle van', $q$select count(*) from public.pricing_rules where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and service_category = 'van' and base_price = 15 and price_per_km = 2.5 and price_per_hour = 30 and minimum_fare = 45 and active$q$, 1);

-- Sans conduite : véhicule sans driver_id, fiche drivers intacte.
UPDATE public.tenants SET setup_completed = false WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT public.complete_tenant_setup(:legal::jsonb, replace(replace(:vehicle, 'SET-001-AA', 'SET-002-AA'), 'true', 'false')::jsonb, :pricing::jsonb);
RESET ROLE;
SELECT pg_temp.expect_count('setup: sans conduite', $q$select count(*) from public.vehicles where plate_number = 'SET-002-AA' and driver_id is null$q$, 1);

DO $$ BEGIN RAISE NOTICE 'RPC tenant checks passed.'; END $$;

ROLLBACK;
