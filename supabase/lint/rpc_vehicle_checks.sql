-- Phase 16 (A-06) : create_vehicle atomique (désactive les autres véhicules actifs dans la même transaction).

\set ON_ERROR_STOP on
\o /dev/null

BEGIN;

\ir _rpc_fixtures.sql

INSERT INTO public.vehicles (id, tenant_id, category, brand, model, plate_number, status) VALUES
  ('ee000000-0000-4000-8000-0000000000bb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'berline', 'Test', 'B', 'RPC-BBB-BB', 'active');

SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');

-- Départ : le véhicule des fixtures est actif
SELECT pg_temp.expect_count('départ : 1 actif', $q$select count(*) from public.vehicles where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and status='active'$q$, 1);

-- Échec au milieu (marque NULL) : l'ancien actif reste actif, rien n'est créé
SELECT pg_temp.expect_sqlstate('atomicité', $q$select public.create_vehicle(NULL,'M','AA-111-AA','berline',4,'active')$q$, '23502');
SELECT pg_temp.expect_count('atomicité : ancien toujours actif', $q$select count(*) from public.vehicles where id='ee000000-0000-4000-8000-00000000000a' and status='active'$q$, 1);
SELECT pg_temp.expect_count('atomicité : rien créé', $q$select count(*) from public.vehicles where plate_number='AA-111-AA'$q$, 0);

-- Création active : un seul actif, le nouveau
SELECT pg_temp.expect_ok('owner : create_vehicle actif', $q$select public.create_vehicle('Tesla','Model S','AA-222-AA','berline',4,'active')$q$);
SELECT pg_temp.expect_count('un seul actif', $q$select count(*) from public.vehicles where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and status='active'$q$, 1);
SELECT pg_temp.expect_count('le nouveau est actif', $q$select count(*) from public.vehicles where plate_number='AA-222-AA' and status='active'$q$, 1);
SELECT pg_temp.expect_count('l''ancien est inactif', $q$select count(*) from public.vehicles where id='ee000000-0000-4000-8000-00000000000a' and status='inactive'$q$, 1);

-- Création inactive : n'éteint personne
SELECT pg_temp.expect_ok('owner : create_vehicle inactif', $q$select public.create_vehicle('Opel','Vivaro','AA-333-AA','van',8,'inactive')$q$);
SELECT pg_temp.expect_count('inactif : toujours un seul actif', $q$select count(*) from public.vehicles where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and status='active'$q$, 1);
SELECT pg_temp.expect_sqlstate('statut invalide', $q$select public.create_vehicle('X','Y','AA-444-AA','van',8,'bidon')$q$, '22P02');
RESET ROLE;

-- Aucun effet sur le tenant B
SELECT pg_temp.expect_count('tenant B intact', $q$select count(*) from public.vehicles where tenant_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and status='active'$q$, 1);

SET LOCAL ROLE authenticated;
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_sqlstate('driver refusé', $q$select public.create_vehicle('Z','Z','AA-555-AA','van',4,'active')$q$, '42501');
RESET ROLE;

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT pg_temp.expect_sqlstate('anon refusé', $q$select public.create_vehicle('Z','Z','AA-555-AA','van',4,'active')$q$, '42501');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'RPC vehicle checks passed.'; END $$;

ROLLBACK;
