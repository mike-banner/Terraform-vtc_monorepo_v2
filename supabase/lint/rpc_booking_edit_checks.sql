-- RPC de modification et de création manuelle de course (Phase 14, plan 05).
-- Exécuté en CI sur une base reconstruite, transaction annulée.
-- DECISION-EDIT: A (plan 14-01) : statuts modifiables pending et accepted, prix manuel conservé, HT/TVA recalculés.

\set ON_ERROR_STOP on
\o /dev/null

BEGIN;

\ir _rpc_fixtures.sql

-- Message ET SQLSTATE exacts.
CREATE FUNCTION pg_temp.expect_error(label text, stmt text, code text, msg text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = code AND SQLERRM = msg THEN RETURN; END IF;
    RAISE EXCEPTION 'FAIL [%] : % / % attendu, % / % obtenu', label, code, msg, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'FAIL [%] : erreur % attendue, instruction acceptée', label, code;
END $$;

-- b10 : course à prix manuel (accepted, cash).
INSERT INTO public.bookings (id, original_tenant_id, current_tenant_id, customer_id, vehicle_id, driver_id, status,
  payment_mode, pickup_time, mission_status, pickup_address, dropoff_address, total_amount, subtotal_amount,
  vat_amount, booking_type, booking_source, pricing_mode) VALUES
  ('b1000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1000000-0000-4000-8000-00000000000a', 'ee000000-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-000000000001', 'accepted', 'cash', now() + interval '3 days', 'not_started', 'A', 'B', 150, 150, 0, 'transfer', 'manual_driver', 'manual');

-- Fixtures locales tenant B (création manuelle).
INSERT INTO public.vehicles (id, tenant_id, driver_id, category, brand, model, plate_number) VALUES
  ('ee000000-0000-4000-8000-0000000000bb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', NULL, 'berline', 'Test', 'B1', 'RPC-B-001');
INSERT INTO public.drivers (id, tenant_id, user_id, first_name, last_name, phone, license_number) VALUES
  ('db000000-0000-4000-8000-0000000000bb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '55555555-5555-4555-8555-555555555555', 'Owner', 'B', '0600000bb0', 'RPCB00000001');
INSERT INTO public.vehicles (id, tenant_id, driver_id, category, brand, model, plate_number) VALUES
  ('ee000000-0000-4000-8000-0000000000bc', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'db000000-0000-4000-8000-0000000000bb', 'berline', 'Test', 'B2', 'RPC-B-002');

SELECT count(*) AS mvts_avant FROM public.financial_movements \gset
SELECT cancellation_policy_id::text AS b1_policy FROM public.bookings WHERE id = 'b1000000-0000-4000-8000-000000000001' \gset

-- update_booking_details : accès ----------------------------------------------
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT pg_temp.expect_denied('update: anon', $q$select public.update_booking_details('b1000000-0000-4000-8000-000000000001', now() + interval '4 days', 'X')$q$);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT pg_temp.login('44444444-4444-4444-8444-444444444444');
SELECT pg_temp.expect_denied('update: driver2 sur b1', $q$select public.update_booking_details('b1000000-0000-4000-8000-000000000001', now() + interval '4 days', 'X')$q$);
SELECT pg_temp.login('55555555-5555-4555-8555-555555555555');
SELECT pg_temp.expect_sqlstate('update: owner B sur b1', $q$select public.update_booking_details('b1000000-0000-4000-8000-000000000001', now() + interval '4 days', 'X')$q$, 'P0002');

-- Modification chauffeur propriétaire.
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_error('update: adresse vide', $q$select public.update_booking_details('b1000000-0000-4000-8000-000000000001', now() + interval '4 days', '')$q$, '22023', 'Date/heure et adresse de départ requis');
CREATE TEMP TABLE _r (k text, v numeric);
GRANT ALL ON _r TO authenticated;
INSERT INTO _r SELECT 'b1', public.update_booking_details('b1000000-0000-4000-8000-000000000001', now() + interval '4 days', 'Nouvelle adresse', NULL, 30);
INSERT INTO _r SELECT 'b10', public.update_booking_details('b1000000-0000-4000-8000-00000000000a', now() + interval '4 days', 'Autre adresse', NULL, 30);

-- Paid : refus, triggers actifs.
SELECT pg_temp.expect_error('update: b4 payée', $q$select public.update_booking_details('b4000000-0000-4000-8000-000000000004', now() + interval '4 days', 'X')$q$, '22023', 'Course non modifiable dans ce statut');
-- owner A sur b3 (pending, sans chauffeur).
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_ok('update: owner sur b3 pending', $q$select public.update_booking_details('b3000000-0000-4000-8000-000000000003', now() + interval '4 days', 'Nouvelle adresse')$q$);
RESET ROLE;

-- Marqueur non persistant.
SELECT pg_temp.expect_count('update: marqueur remis à vide', $q$select count(*) from (select 1) x where current_setting('vtc.trusted_rpc', true) = ''$q$, 1);
SELECT pg_temp.expect_error('update: immuabilité intacte hors RPC', $q$update public.bookings set total_amount = 1 where id = 'b1000000-0000-4000-8000-000000000001'$q$, 'P0001', 'Booking immutable after pending status');

SELECT pg_temp.expect_count('update: b1 retour 70', $q$select count(*) from _r where k = 'b1' and v = 70$q$, 1);
SELECT pg_temp.expect_count('update: b1 en base', $q$select count(*) from public.bookings where id = 'b1000000-0000-4000-8000-000000000001' and total_amount = 70 and subtotal_amount = 63.64 and vat_amount = 6.36 and pickup_address = 'Nouvelle adresse' and distance_km = 30$q$, 1);
SELECT pg_temp.expect_count('update: b10 prix manuel conservé', $q$select count(*) from _r where k = 'b10' and v = 150$q$, 1);
SELECT pg_temp.expect_count('update: b10 HT/TVA recalculés', $q$select count(*) from public.bookings where id = 'b1000000-0000-4000-8000-00000000000a' and total_amount = 150 and subtotal_amount = 136.36 and vat_amount = 13.64$q$, 1);
SELECT pg_temp.expect_count('update: b3 modifiée', $q$select count(*) from public.bookings where id = 'b3000000-0000-4000-8000-000000000003' and pickup_address = 'Nouvelle adresse'$q$, 1);
SELECT pg_temp.expect_count('update: policy inchangée', format($q$select count(*) from public.bookings where id = 'b1000000-0000-4000-8000-000000000001' and cancellation_policy_id::text is not distinct from nullif(%L, '')$q$, :'b1_policy'), 1);

-- Prod : trigger de garde désactivé, la RPC doit tenir seule.
SELECT pickup_time AS b4_pickup FROM public.bookings WHERE id = 'b4000000-0000-4000-8000-000000000004' \gset
ALTER TABLE public.bookings DISABLE TRIGGER trg_prevent_pickup_time_change_after_paid;
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_error('update: b4 payée, trigger désactivé', $q$select public.update_booking_details('b4000000-0000-4000-8000-000000000004', now() + interval '9 days', 'X')$q$, '22023', 'Course non modifiable dans ce statut');
RESET ROLE;
ALTER TABLE public.bookings ENABLE TRIGGER trg_prevent_pickup_time_change_after_paid;
SELECT pg_temp.expect_count('update: b4 pickup inchangé', format($q$select count(*) from public.bookings where id = 'b4000000-0000-4000-8000-000000000004' and pickup_time = %L$q$, :'b4_pickup'), 1);

-- Mission démarrée.
UPDATE public.bookings SET mission_status = 'in_progress' WHERE id = 'b2000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_error('update: mission démarrée', $q$select public.update_booking_details('b2000000-0000-4000-8000-000000000002', now() + interval '4 days', 'X')$q$, '22023', 'Action impossible : mission déjà démarrée ou terminée');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'RPC booking edit checks passed.'; END $$;

ROLLBACK;
