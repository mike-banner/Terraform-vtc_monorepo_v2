-- Tests RLS par rôle tenant (Phase 13) — exécuté en CI après security_checks.sql,
-- sur une base reconstruite depuis supabase/migrations/.
--
-- Pour chaque rôle (owner, manager, driver, autre tenant, anon), chaque opération
-- autorisée passe et chaque opération interdite échoue. Tout tourne dans une
-- transaction annulée : aucune donnée ne reste.
--
-- Chaque écriture testée est exécutée puis annulée (sous-transaction), les
-- tests sont donc indépendants de leur ordre.

\set ON_ERROR_STOP on
\o /dev/null

BEGIN;

-- Helpers ---------------------------------------------------------------------
-- Nombre de lignes renvoyées par une requête de comptage.
CREATE FUNCTION pg_temp.expect_count(label text, query text, expected bigint)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE query INTO n;
  IF n IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'FAIL [%] : % ligne(s) attendue(s), % obtenue(s)', label, expected, n;
  END IF;
END $$;

-- Nombre de lignes affectées par une écriture, écriture annulée ensuite.
CREATE FUNCTION pg_temp.expect_affected(label text, stmt text, expected bigint)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  BEGIN
    EXECUTE stmt;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE EXCEPTION USING ERRCODE = 'P0099';
  EXCEPTION WHEN SQLSTATE 'P0099' THEN NULL;
  END;
  IF n IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'FAIL [%] : % ligne(s) affectée(s) attendue(s), % obtenue(s)', label, expected, n;
  END IF;
END $$;

-- Écriture qui doit être refusée (42501 : RLS WITH CHECK ou privilège de colonne).
CREATE FUNCTION pg_temp.expect_denied(label text, stmt text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN insufficient_privilege THEN
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL [%] : refus 42501 attendu, écriture acceptée', label;
END $$;

-- Fixtures (postgres, BYPASSRLS) ---------------------------------------------
INSERT INTO public.tenants (id, name, primary_domain) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'RLS Test A', 'rls-test-a.invalid'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'RLS Test B', 'rls-test-b.invalid');

-- handle_new_user crée le profil (tenant_role 'pending').
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-4111-8111-111111111111', 'owner-a@rls.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'manager-a@rls.invalid'),
  ('33333333-3333-4333-8333-333333333333', 'driver1-a@rls.invalid'),
  ('44444444-4444-4444-8444-444444444444', 'driver2-a@rls.invalid'),
  ('55555555-5555-4555-8555-555555555555', 'owner-b@rls.invalid');

UPDATE public.profiles SET tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tenant_role = 'owner'
  WHERE id = '11111111-1111-4111-8111-111111111111';
UPDATE public.profiles SET tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tenant_role = 'manager'
  WHERE id = '22222222-2222-4222-8222-222222222222';
UPDATE public.profiles SET tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tenant_role = 'driver'
  WHERE id IN ('33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444');
UPDATE public.profiles SET tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tenant_role = 'owner'
  WHERE id = '55555555-5555-4555-8555-555555555555';

INSERT INTO public.drivers (id, tenant_id, user_id, first_name, last_name, phone, license_number) VALUES
  ('d1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'Un', 'Chauffeur', '0600000001', 'RLS000000001'),
  ('d2000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '44444444-4444-4444-8444-444444444444', 'Deux', 'Chauffeur', '0600000002', 'RLS000000002'),
  ('db000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', NULL, 'Autre', 'Tenant', '0600000003', 'RLS000000003');

INSERT INTO public.vehicles (id, tenant_id, brand, model, plate_number) VALUES
  ('ee000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Test', 'A', 'RLS-001-AA');

INSERT INTO public.pricing_rules (id, tenant_id, base_price, price_per_km, minimum_fare, service_category) VALUES
  ('ff000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 10, 2, 20, 'berline');

INSERT INTO public.customers (id, tenant_id, email, first_name) VALUES
  ('c1000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'client-a@rls.invalid', 'ClientA'),
  ('c2000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'client-a2@rls.invalid', 'ClientA2'),
  ('c1000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'client-b@rls.invalid', 'ClientB');

-- BK1 : driver1 ; BK2 : driver2 ; BK3 : non assignée ; BK4 : acceptée (Phase 11) ; BKB : tenant B.
INSERT INTO public.bookings (id, original_tenant_id, current_tenant_id, customer_id, driver_id, status,
  pickup_address, dropoff_address, pickup_time, total_amount, subtotal_amount, payment_mode,
  booking_type, booking_source, pricing_mode) VALUES
  ('b1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1000000-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-000000000001', 'pending',  'A', 'B', now() + interval '3 days', 100, 83.33, 'card', 'transfer', 'manual_driver', 'direct'),
  ('b2000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1000000-0000-4000-8000-00000000000a', 'd2000000-0000-4000-8000-000000000002', 'pending',  'A', 'B', now() + interval '3 days', 100, 83.33, 'card', 'transfer', 'manual_driver', 'direct'),
  ('b3000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1000000-0000-4000-8000-00000000000a', NULL,                                    'pending',  'A', 'B', now() + interval '3 days', 100, 83.33, 'card', 'transfer', 'manual_driver', 'direct'),
  ('b4000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1000000-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-000000000001', 'accepted', 'A', 'B', now() + interval '3 days', 100, 83.33, 'card', 'transfer', 'manual_driver', 'direct'),
  ('bb000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'c1000000-0000-4000-8000-00000000000b', NULL,                                    'pending',  'A', 'B', now() + interval '3 days', 100, 83.33, 'card', 'transfer', 'manual_driver', 'direct');

INSERT INTO public.financial_movements (id, booking_id, tenant_id, movement_type, direction, gross_amount, net_amount) VALUES
  ('fa000000-0000-4000-8000-00000000000a', 'b1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'payment', 'credit', 10, 10),
  ('fb000000-0000-4000-8000-00000000000b', 'bb000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'payment', 'credit', 10, 10);

-- Non-régression Phase 11 (postgres : ni RLS ni grants, seul le trigger joue) --
DO $$
BEGIN
  BEGIN
    UPDATE public.bookings SET total_amount = 1 WHERE id = 'b4000000-0000-4000-8000-000000000004';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Booking immutable after pending status' THEN RAISE; END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL [phase11] : protect_booking_immutable_fields ne bloque plus total_amount après pending';
END $$;

SET LOCAL ROLE authenticated;

-- driver1 (tenant A) ----------------------------------------------------------
SELECT set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);

SELECT pg_temp.expect_count('driver bookings select tenant (D-03)', 'select count(*) from public.bookings', 4);
SELECT pg_temp.expect_affected('driver update sa course (D-05)', $q$update public.bookings set mission_note = 'x' where id = 'b1000000-0000-4000-8000-000000000001'$q$, 1);
SELECT pg_temp.expect_affected('driver update course d''un autre (D-05)', $q$update public.bookings set mission_note = 'x' where id = 'b2000000-0000-4000-8000-000000000002'$q$, 0);
SELECT pg_temp.expect_affected('driver update course non assignée (D-05)', $q$update public.bookings set mission_note = 'x' where id = 'b3000000-0000-4000-8000-000000000003'$q$, 0);
SELECT pg_temp.expect_denied('driver cède sa course (D-05)', $q$update public.bookings set driver_id = 'd2000000-0000-4000-8000-000000000002' where id = 'b1000000-0000-4000-8000-000000000001'$q$);
SELECT pg_temp.expect_denied('driver total_amount sa course pending (R4)', $q$update public.bookings set total_amount = 1 where id = 'b1000000-0000-4000-8000-000000000001'$q$);
SELECT pg_temp.expect_denied('driver status sa course (R4)', $q$update public.bookings set status = 'cancelled' where id = 'b1000000-0000-4000-8000-000000000001'$q$);
SELECT pg_temp.expect_denied('driver insert booking (R4)', $q$insert into public.bookings (original_tenant_id, current_tenant_id, customer_id, pickup_address, dropoff_address, pickup_time, total_amount, subtotal_amount, payment_mode, booking_type, booking_source, pricing_mode) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1000000-0000-4000-8000-00000000000a', 'A', 'B', now() + interval '3 days', 1, 1, 'card', 'transfer', 'manual_driver', 'direct')$q$);

SELECT pg_temp.expect_count('driver drivers select', 'select count(*) from public.drivers', 2);
-- D-08 révisé : le driver ne modifie que le phone de sa propre fiche.
SELECT pg_temp.expect_affected('driver update phone sa fiche (D-08)', $q$update public.drivers set phone = '0699999999' where id = 'd1000000-0000-4000-8000-000000000001'$q$, 1);
-- Payload réel d'EditableDriverCard : les 4 colonnes, seul phone change.
SELECT pg_temp.expect_affected('driver sauvegarde EditableDriverCard (D-08)', $q$update public.drivers set first_name = 'Un', last_name = 'Chauffeur', phone = '0699999999', license_number = 'RLS000000001' where id = 'd1000000-0000-4000-8000-000000000001'$q$, 1);
SELECT pg_temp.expect_denied('driver update first_name sa fiche (D-08)', $q$update public.drivers set first_name = 'x' where id = 'd1000000-0000-4000-8000-000000000001'$q$);
SELECT pg_temp.expect_denied('driver update last_name sa fiche (D-08)', $q$update public.drivers set last_name = 'x' where id = 'd1000000-0000-4000-8000-000000000001'$q$);
SELECT pg_temp.expect_denied('driver update license_number sa fiche (D-08)', $q$update public.drivers set license_number = 'RLS000000099' where id = 'd1000000-0000-4000-8000-000000000001'$q$);
SELECT pg_temp.expect_denied('driver update user_id sa fiche (D-08)', $q$update public.drivers set user_id = '44444444-4444-4444-8444-444444444444' where id = 'd1000000-0000-4000-8000-000000000001'$q$);
SELECT pg_temp.expect_affected('driver update phone fiche d''un autre (D-08)', $q$update public.drivers set phone = '0699999999' where id = 'd2000000-0000-4000-8000-000000000002'$q$, 0);
SELECT pg_temp.expect_affected('driver update first_name fiche d''un autre (D-08)', $q$update public.drivers set first_name = 'x' where id = 'd2000000-0000-4000-8000-000000000002'$q$, 0);
SELECT pg_temp.expect_affected('driver delete sa fiche (D-08)', $q$delete from public.drivers where id = 'd1000000-0000-4000-8000-000000000001'$q$, 0);
SELECT pg_temp.expect_affected('driver delete drivers (D-08)', $q$delete from public.drivers where id = 'd2000000-0000-4000-8000-000000000002'$q$, 0);
SELECT pg_temp.expect_denied('driver insert drivers (D-08)', $q$insert into public.drivers (tenant_id, first_name, last_name, phone, license_number) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'x', 'y', '0600000009', 'RLS000000009')$q$);

SELECT pg_temp.expect_count('driver vehicles select (D-11)', 'select count(*) from public.vehicles', 1);
SELECT pg_temp.expect_affected('driver update vehicles (D-11)', $q$update public.vehicles set model = 'x' where id = 'ee000000-0000-4000-8000-00000000000a'$q$, 0);
SELECT pg_temp.expect_affected('driver delete vehicles (D-11)', $q$delete from public.vehicles where id = 'ee000000-0000-4000-8000-00000000000a'$q$, 0);
SELECT pg_temp.expect_denied('driver insert vehicles (D-11)', $q$insert into public.vehicles (tenant_id, brand, model, plate_number) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'x', 'y', 'RLS-009-ZZ')$q$);

SELECT pg_temp.expect_count('driver pricing select (D-11)', $q$select count(*) from public.pricing_rules where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, 1);
SELECT pg_temp.expect_affected('driver update pricing (D-11)', $q$update public.pricing_rules set base_price = 1 where id = 'ff000000-0000-4000-8000-00000000000a'$q$, 0);
SELECT pg_temp.expect_affected('driver delete pricing (D-11)', $q$delete from public.pricing_rules where id = 'ff000000-0000-4000-8000-00000000000a'$q$, 0);
SELECT pg_temp.expect_denied('driver insert pricing (D-11)', $q$insert into public.pricing_rules (tenant_id, base_price, price_per_km, minimum_fare, service_category) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, 1, 1, 'van')$q$);

SELECT pg_temp.expect_count('driver ledger (D-09)', 'select count(*) from public.financial_movements', 0);

SELECT pg_temp.expect_count('driver customers select (D-10)', 'select count(*) from public.customers', 2);
SELECT pg_temp.expect_affected('driver update customer (D-10)', $q$update public.customers set first_name = 'x' where id = 'c1000000-0000-4000-8000-00000000000a'$q$, 1);
SELECT pg_temp.expect_affected('driver insert customer (D-10)', $q$insert into public.customers (tenant_id, email, first_name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'x@rls.invalid', 'x')$q$, 1);
SELECT pg_temp.expect_affected('driver update customer autre tenant', $q$update public.customers set first_name = 'x' where id = 'c1000000-0000-4000-8000-00000000000b'$q$, 0);

-- owner puis manager (tenant A) : droits identiques (D-01) --------------------
DO $$
DECLARE
  who text;
BEGIN
  FOREACH who IN ARRAY ARRAY['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'] LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);

    PERFORM pg_temp.expect_count(who || ' bookings select (D-04)', 'select count(*) from public.bookings', 4);
    PERFORM pg_temp.expect_affected(who || ' réassigne une course (D-06)', $q$update public.bookings set driver_id = 'd2000000-0000-4000-8000-000000000002' where id = 'b1000000-0000-4000-8000-000000000001'$q$, 1);
    PERFORM pg_temp.expect_affected(who || ' assigne une course libre (D-06)', $q$update public.bookings set driver_id = 'd1000000-0000-4000-8000-000000000001' where id = 'b3000000-0000-4000-8000-000000000003'$q$, 1);
    PERFORM pg_temp.expect_denied(who || ' assigne un chauffeur d''un autre tenant', $q$update public.bookings set driver_id = 'db000000-0000-4000-8000-00000000000b' where id = 'b1000000-0000-4000-8000-000000000001'$q$);
    PERFORM pg_temp.expect_denied(who || ' total_amount (R4)', $q$update public.bookings set total_amount = 1 where id = 'b1000000-0000-4000-8000-000000000001'$q$);
    PERFORM pg_temp.expect_denied(who || ' status (R4)', $q$update public.bookings set status = 'cancelled' where id = 'b1000000-0000-4000-8000-000000000001'$q$);
    PERFORM pg_temp.expect_affected(who || ' update course autre tenant', $q$update public.bookings set mission_note = 'x' where id = 'bb000000-0000-4000-8000-00000000000b'$q$, 0);

    PERFORM pg_temp.expect_affected(who || ' insert drivers (D-07)', $q$insert into public.drivers (tenant_id, first_name, last_name, phone, license_number) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'x', 'y', '0600000009', 'RLS000000009')$q$, 1);
    PERFORM pg_temp.expect_affected(who || ' update drivers (D-07)', $q$update public.drivers set first_name = 'x' where id = 'd1000000-0000-4000-8000-000000000001'$q$, 1);
    PERFORM pg_temp.expect_affected(who || ' delete drivers (D-07)', $q$delete from public.drivers where id = 'd2000000-0000-4000-8000-000000000002'$q$, 1);
    PERFORM pg_temp.expect_denied(who || ' insert drivers autre tenant', $q$insert into public.drivers (tenant_id, first_name, last_name, phone, license_number) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'x', 'y', '0600000008', 'RLS000000008')$q$);

    PERFORM pg_temp.expect_affected(who || ' insert vehicles (D-01)', $q$insert into public.vehicles (tenant_id, brand, model, plate_number) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'x', 'y', 'RLS-009-ZZ')$q$, 1);
    PERFORM pg_temp.expect_affected(who || ' update vehicles (D-01)', $q$update public.vehicles set model = 'x' where id = 'ee000000-0000-4000-8000-00000000000a'$q$, 1);
    PERFORM pg_temp.expect_affected(who || ' delete vehicles (D-01)', $q$delete from public.vehicles where id = 'ee000000-0000-4000-8000-00000000000a'$q$, 1);

    PERFORM pg_temp.expect_affected(who || ' insert pricing (D-01)', $q$insert into public.pricing_rules (tenant_id, base_price, price_per_km, minimum_fare, service_category) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, 1, 1, 'van')$q$, 1);
    PERFORM pg_temp.expect_affected(who || ' update pricing (D-01)', $q$update public.pricing_rules set base_price = 1 where id = 'ff000000-0000-4000-8000-00000000000a'$q$, 1);
    PERFORM pg_temp.expect_affected(who || ' delete pricing (D-01)', $q$delete from public.pricing_rules where id = 'ff000000-0000-4000-8000-00000000000a'$q$, 1);

    PERFORM pg_temp.expect_count(who || ' ledger (D-09)', 'select count(*) from public.financial_movements', 1);
    PERFORM pg_temp.expect_denied(who || ' insert ledger (service_role seul)', $q$insert into public.financial_movements (booking_id, tenant_id, movement_type, direction, gross_amount, net_amount) values ('b1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'payment', 'credit', 1, 1)$q$);

    PERFORM pg_temp.expect_affected(who || ' delete customer (D-10)', $q$delete from public.customers where id = 'c2000000-0000-4000-8000-00000000000a'$q$, 1);
  END LOOP;
END $$;

-- owner du tenant B : cloisonnement ------------------------------------------
SELECT set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}', true);
SELECT pg_temp.expect_count('tenant B bookings', 'select count(*) from public.bookings', 1);
SELECT pg_temp.expect_count('tenant B ledger', 'select count(*) from public.financial_movements', 1);
SELECT pg_temp.expect_count('tenant B drivers', 'select count(*) from public.drivers', 1);
SELECT pg_temp.expect_affected('tenant B update course tenant A', $q$update public.bookings set mission_note = 'x' where id = 'b1000000-0000-4000-8000-000000000001'$q$, 0);

-- anon ------------------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT pg_temp.expect_count('anon bookings', 'select count(*) from public.bookings', 0);
SELECT pg_temp.expect_count('anon ledger', 'select count(*) from public.financial_movements', 0);
SELECT pg_temp.expect_count('anon drivers', 'select count(*) from public.drivers', 0);
SELECT pg_temp.expect_count('anon pricing tunnel public (Phase 12)', $q$select count(*) from public.pricing_rules where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, 1);

RESET ROLE;
DO $$ BEGIN RAISE NOTICE 'RLS role checks passed.'; END $$;
ROLLBACK;
