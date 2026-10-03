-- Plan 14.1-13 : zones (codes postaux, doublons D-44, écriture owner/manager), trajets fixes,
-- bookings.address_alert et mark_address_verified (D-42). Transaction annulée.

\set ON_ERROR_STOP on
\o /dev/null

BEGIN;

\ir _rpc_fixtures.sql

-- Échec attendu avec ce SQLSTATE ET un message contenant le motif (like).
CREATE FUNCTION pg_temp.expect_msg(label text, stmt text, code text, motif text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = code AND SQLERRM LIKE motif THEN RETURN; END IF;
    RAISE EXCEPTION 'FAIL [%] : % / "%" attendu, % (%) obtenu', label, code, motif, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'FAIL [%] : erreur attendue, instruction acceptée', label;
END $$;

-- Zones préexistantes (postgres) : A porte Poissy ; B couvre les mêmes codes et le même nom.
INSERT INTO public.zones (id, tenant_id, name, postal_codes) VALUES
  ('2a000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Poissy', '{78300}'),
  ('2b000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Poissy', '{78300,75001}'),
  ('2c000000-0000-4000-8000-00000000000c', NULL, 'Zone prod', '{91000}');

-- owner A -------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');

SELECT pg_temp.expect_ok('owner: INSERT zone', $q$insert into public.zones (id, tenant_id, name, postal_codes) values ('2a000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Paris','{75001,75008}')$q$);
SELECT pg_temp.expect_count('owner: UPDATE codes', $q$with u as (update public.zones set postal_codes = '{75001,75008,75009}' where id = '2a000000-0000-4000-8000-000000000001' returning 1) select count(*) from u$q$, 1);
SELECT pg_temp.expect_count('owner: DELETE zone sans policy', $q$with d as (delete from public.zones where id = '2a000000-0000-4000-8000-000000000001' returning 1) select count(*) from d$q$, 0);
SELECT pg_temp.expect_denied('owner: INSERT zone du tenant B', $q$insert into public.zones (tenant_id, name) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Intrus')$q$);
SELECT pg_temp.expect_count('owner: UPDATE zone de B', $q$with u as (update public.zones set postal_codes = '{12345}' where id = '2b000000-0000-4000-8000-00000000000b' returning 1) select count(*) from u$q$, 0);
SELECT pg_temp.expect_count('owner: UPDATE zone prod NULL', $q$with u as (update public.zones set postal_codes = '{12345}' where id = '2c000000-0000-4000-8000-00000000000c' returning 1) select count(*) from u$q$, 0);

-- D-44 doublons
SELECT pg_temp.expect_msg('nom: casse', $q$insert into public.zones (tenant_id, name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','poissy')$q$, '23505', 'Une zone de ce nom existe déjà%');
SELECT pg_temp.expect_msg('nom: espaces', $q$insert into public.zones (tenant_id, name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','POISSY  ')$q$, '23505', 'Une zone de ce nom existe déjà%');
SELECT pg_temp.expect_msg('code partagé INSERT', $q$insert into public.zones (tenant_id, name, postal_codes) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Autre','{78300}')$q$, '23505', 'Ce code postal est déjà couvert par la zone Poissy%');
SELECT pg_temp.expect_msg('code partagé UPDATE', $q$update public.zones set postal_codes = '{75001,78300}' where id = '2a000000-0000-4000-8000-000000000001'$q$, '23505', 'Ce code postal est déjà couvert par la zone Poissy%');
SELECT pg_temp.expect_ok('UPDATE avec ses propres codes', $q$update public.zones set postal_codes = '{75001,75008,75009}' where id = '2a000000-0000-4000-8000-000000000001'$q$);
SELECT pg_temp.expect_ok('UPDATE sans changer les codes', $q$update public.zones set name = 'Paris centre' where id = '2a000000-0000-4000-8000-000000000001'$q$);
SELECT pg_temp.expect_ok('zone sans code 1', $q$insert into public.zones (tenant_id, name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Aéroport')$q$);
SELECT pg_temp.expect_ok('zone sans code 2', $q$insert into public.zones (tenant_id, name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Parc')$q$);
-- Jamais le nom d'une zone de B : A et B partagent 78300 et 75001, et le nom Poissy.
SELECT pg_temp.expect_msg('confidentialité: pas de zone de B citée', $q$insert into public.zones (tenant_id, name, postal_codes) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Autre2','{78300,78301}')$q$, '23505', '%zone Poissy (code : 78300)');

-- codes invalides et limites
SELECT pg_temp.expect_sqlstate('codes: 4 chiffres', $q$insert into public.zones (tenant_id, name, postal_codes) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','C1','{7500}')$q$, '23514');
SELECT pg_temp.expect_sqlstate('codes: lettres', $q$insert into public.zones (tenant_id, name, postal_codes) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','C2','{ABCDE}')$q$, '23514');
SELECT pg_temp.expect_sqlstate('codes: élément vide', $q$insert into public.zones (tenant_id, name, postal_codes) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','C3','{94001,""}')$q$, '23514');
SELECT pg_temp.expect_sqlstate('codes: 51 codes', $q$insert into public.zones (tenant_id, name, postal_codes) select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','C4', array_agg(lpad(i::text,5,'0')) from generate_series(1,51) i$q$, '23514');
SELECT pg_temp.expect_ok('codes: 50 codes', $q$insert into public.zones (tenant_id, name, postal_codes) select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','C5', array_agg(lpad(i::text,5,'0')) from generate_series(1,50) i$q$);
SELECT pg_temp.expect_ok('codes: même code deux fois', $q$insert into public.zones (tenant_id, name, postal_codes) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','C6','{94000,94000}')$q$);

-- trajets
SELECT pg_temp.expect_ok('trajet: INSERT', $q$insert into public.fixed_routes (id, tenant_id, pickup_zone_id, dropoff_zone_id, vehicle_category, price) values ('3a000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2a000000-0000-4000-8000-00000000000a','2a000000-0000-4000-8000-000000000001','berline',50)$q$);
SELECT pg_temp.expect_denied('trajet: tenant B', $q$insert into public.fixed_routes (tenant_id, pickup_zone_id, dropoff_zone_id, vehicle_category, price) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2b000000-0000-4000-8000-00000000000b','2b000000-0000-4000-8000-00000000000b','berline',50)$q$);
SELECT pg_temp.expect_denied('trajet: zone départ de B', $q$insert into public.fixed_routes (tenant_id, pickup_zone_id, dropoff_zone_id, vehicle_category, price) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2b000000-0000-4000-8000-00000000000b','2a000000-0000-4000-8000-00000000000a','berline',60)$q$);
SELECT pg_temp.expect_denied('trajet: zone arrivée de B', $q$insert into public.fixed_routes (tenant_id, pickup_zone_id, dropoff_zone_id, vehicle_category, price) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2a000000-0000-4000-8000-00000000000a','2b000000-0000-4000-8000-00000000000b','berline',60)$q$);
SELECT pg_temp.expect_denied('trajet: UPDATE vers zone de B', $q$update public.fixed_routes set dropoff_zone_id = '2b000000-0000-4000-8000-00000000000b' where id = '3a000000-0000-4000-8000-000000000001'$q$);
SELECT pg_temp.expect_count('trajet: DELETE', $q$with d as (delete from public.fixed_routes where id = '3a000000-0000-4000-8000-000000000001' returning 1) select count(*) from d$q$, 1);

-- manager A
SELECT pg_temp.login('22222222-2222-4222-8222-222222222222');
SELECT pg_temp.expect_ok('manager: INSERT zone', $q$insert into public.zones (tenant_id, name, postal_codes) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Versailles','{78000}')$q$);
SELECT pg_temp.expect_count('manager: UPDATE zone', $q$with u as (update public.zones set postal_codes = '{78000,78001}' where name = 'Versailles' returning 1) select count(*) from u$q$, 1);
SELECT pg_temp.expect_count('manager: DELETE zone', $q$with d as (delete from public.zones where name = 'Versailles' returning 1) select count(*) from d$q$, 0);

-- driver A
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_denied('driver: INSERT zone', $q$insert into public.zones (tenant_id, name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Driver')$q$);
SELECT pg_temp.expect_count('driver: UPDATE zone', $q$with u as (update public.zones set postal_codes = '{11111}' where name = 'Poissy' returning 1) select count(*) from u$q$, 0);
SELECT pg_temp.expect_count('driver: DELETE zone', $q$with d as (delete from public.zones where name = 'Poissy' returning 1) select count(*) from d$q$, 0);
SELECT pg_temp.expect_denied('driver: INSERT trajet', $q$insert into public.fixed_routes (tenant_id, pickup_zone_id, dropoff_zone_id, vehicle_category, price) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2a000000-0000-4000-8000-00000000000a','2a000000-0000-4000-8000-000000000001','berline',50)$q$);

-- Tenant B couvre les mêmes codes que A : accepté (vu plus haut, zone préexistante) et à l'INSERT
SELECT pg_temp.login('55555555-5555-4555-8555-555555555555');
SELECT pg_temp.expect_ok('B: mêmes nom et code que A', $q$insert into public.zones (tenant_id, name, postal_codes) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Paris centre','{75008,75009}')$q$);

-- anon
RESET ROLE;
SET LOCAL ROLE anon;
SELECT pg_temp.expect_denied('anon: INSERT zone', $q$insert into public.zones (tenant_id, name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Anon')$q$);
SELECT pg_temp.expect_count('anon: lit postal_codes', $q$select count(*) from public.zones where id = '2a000000-0000-4000-8000-00000000000a' and postal_codes = '{78300}'$q$, 1);
RESET ROLE;

-- address_alert ---------------------------------------------------------------
UPDATE public.bookings SET address_alert = 'hors_zone_depart' WHERE id = 'b1000000-0000-4000-8000-000000000001';
SELECT pg_temp.expect_sqlstate('alert: valeur inconnue', $q$update public.bookings set address_alert = 'foo' where id = 'b1000000-0000-4000-8000-000000000001'$q$, '23514');
SELECT pg_temp.expect_count('alert: NULL par défaut', $q$select count(*) from public.bookings where id = 'b2000000-0000-4000-8000-000000000002' and address_alert is null$q$, 1);
SELECT pg_temp.expect_count('alert: aucun privilège de colonne', $q$select count(*) from unnest(array['anon','authenticated']) r where has_column_privilege(r, 'public.bookings', 'address_alert', 'UPDATE')$q$, 0);
SELECT pg_temp.expect_count('mark: anon sans EXECUTE', $q$select count(*) from pg_proc where proname = 'mark_address_verified' and has_function_privilege('anon', oid, 'EXECUTE')$q$, 0);

UPDATE public.bookings SET address_alert = 'a_verifier' WHERE id IN
  ('b1000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000002','b4000000-0000-4000-8000-000000000004','bb000000-0000-4000-8000-00000000000b');

SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_denied('alert: UPDATE direct refusé', $q$update public.bookings set address_alert = null where id = 'b1000000-0000-4000-8000-000000000001'$q$);
SELECT pg_temp.expect_count('mark: owner', $q$select count(*) from (select public.mark_address_verified('b4000000-0000-4000-8000-000000000004') v) s where v = 'verifie'$q$, 1);
SELECT pg_temp.expect_count('mark: idempotent', $q$select count(*) from (select public.mark_address_verified('b4000000-0000-4000-8000-000000000004') v) s where v = 'verifie'$q$, 1);
SELECT pg_temp.expect_sqlstate('mark: sans signalement', $q$select public.mark_address_verified('b3000000-0000-4000-8000-000000000003')$q$, '22023');
SELECT pg_temp.login('22222222-2222-4222-8222-222222222222');
SELECT pg_temp.expect_ok('mark: manager', $q$select public.mark_address_verified('b2000000-0000-4000-8000-000000000002')$q$);
SELECT pg_temp.login('44444444-4444-4444-8444-444444444444');
SELECT pg_temp.expect_sqlstate('mark: driver2 sur la course de driver1', $q$select public.mark_address_verified('b1000000-0000-4000-8000-000000000001')$q$, '42501');
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_ok('mark: driver1 sa course', $q$select public.mark_address_verified('b1000000-0000-4000-8000-000000000001')$q$);
SELECT pg_temp.login('55555555-5555-4555-8555-555555555555');
SELECT pg_temp.expect_sqlstate('mark: owner B sur course de A', $q$select public.mark_address_verified('b1000000-0000-4000-8000-000000000001')$q$, 'P0002');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT pg_temp.expect_denied('mark: anon', $q$select public.mark_address_verified('b1000000-0000-4000-8000-000000000001')$q$);
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'Zones checks passed.'; END $$;

ROLLBACK;
