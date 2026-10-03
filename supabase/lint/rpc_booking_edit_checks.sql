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
CREATE TEMP TABLE _pol AS SELECT cancellation_policy_id FROM public.bookings WHERE id = 'b1000000-0000-4000-8000-000000000001';

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
SELECT pg_temp.expect_count('update: policy inchangée', $q$select count(*) from public.bookings b, _pol p where b.id = 'b1000000-0000-4000-8000-000000000001' and b.cancellation_policy_id is not distinct from p.cancellation_policy_id$q$, 1);

-- Montant modifiable (owner/manager) -----------------------------------------------
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_error('update: driver ne change pas le montant', $q$select public.update_booking_details('b1000000-0000-4000-8000-00000000000a', now() + interval '4 days', 'X', NULL, NULL, NULL, 80)$q$, '42501', 'Seuls le propriétaire et le manager peuvent modifier le montant');
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_error('update: montant 0', $q$select public.update_booking_details('b1000000-0000-4000-8000-00000000000a', now() + interval '4 days', 'X', NULL, NULL, NULL, 0)$q$, '22023', 'Montant invalide : 0€');
SELECT pg_temp.expect_error('update: montant 100000', $q$select public.update_booking_details('b1000000-0000-4000-8000-00000000000a', now() + interval '4 days', 'X', NULL, NULL, NULL, 100000)$q$, '22023', 'Montant invalide : 100000€');
INSERT INTO _r SELECT 'b10_prix', public.update_booking_details('b1000000-0000-4000-8000-00000000000a', now() + interval '4 days', 'Autre adresse', NULL, NULL, NULL, 200);
INSERT INTO _r SELECT 'b3_prix', public.update_booking_details('b3000000-0000-4000-8000-000000000003', now() + interval '4 days', 'Nouvelle adresse', NULL, NULL, NULL, 55);
RESET ROLE;
SELECT pg_temp.expect_count('update: b10 montant 200', $q$select count(*) from _r where k = 'b10_prix' and v = 200$q$, 1);
SELECT pg_temp.expect_count('update: b10 en base', $q$select count(*) from public.bookings where id = 'b1000000-0000-4000-8000-00000000000a' and total_amount = 200 and subtotal_amount = 181.82 and vat_amount = 18.18 and pricing_mode = 'manual'$q$, 1);
SELECT pg_temp.expect_count('update: b3 passe en prix manuel', $q$select count(*) from public.bookings where id = 'b3000000-0000-4000-8000-000000000003' and total_amount = 55 and pricing_mode = 'manual'$q$, 1);

-- Prod : trigger de garde désactivé, la RPC doit tenir seule.
CREATE TEMP TABLE _b4 AS SELECT pickup_time FROM public.bookings WHERE id = 'b4000000-0000-4000-8000-000000000004';
ALTER TABLE public.bookings DISABLE TRIGGER trg_prevent_pickup_time_change_after_paid;
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_error('update: b4 payée, trigger désactivé', $q$select public.update_booking_details('b4000000-0000-4000-8000-000000000004', now() + interval '9 days', 'X')$q$, '22023', 'Course non modifiable dans ce statut');
RESET ROLE;
ALTER TABLE public.bookings ENABLE TRIGGER trg_prevent_pickup_time_change_after_paid;
SELECT pg_temp.expect_count('update: b4 pickup inchangé', $q$select count(*) from public.bookings b, _b4 p where b.id = 'b4000000-0000-4000-8000-000000000004' and b.pickup_time = p.pickup_time$q$, 1);

-- Mission démarrée.
UPDATE public.bookings SET mission_status = 'in_progress' WHERE id = 'b2000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_error('update: mission démarrée', $q$select public.update_booking_details('b2000000-0000-4000-8000-000000000002', now() + interval '4 days', 'X')$q$, '22023', 'Action impossible : mission déjà démarrée ou terminée');
RESET ROLE;

-- create_manual_booking -----------------------------------------------------------
CREATE TEMP TABLE _c (k text, booking_id uuid, total_price numeric);
GRANT ALL ON _c TO authenticated;
CREATE TEMP TABLE _n (k text, n bigint);

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT pg_temp.expect_denied('create: anon', $q$select * from public.create_manual_booking('Gare', 'Hôtel', now() + interval '2 days', 'Jean Dupont', 'jean@rpc.invalid')$q$);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_denied('create: driver1', $q$select * from public.create_manual_booking('Gare', 'Hôtel', now() + interval '2 days', 'Jean Dupont', 'jean@rpc.invalid')$q$);
SELECT pg_temp.login('66666666-6666-4666-8666-666666666666');
SELECT pg_temp.expect_denied('create: pending', $q$select * from public.create_manual_booking('Gare', 'Hôtel', now() + interval '2 days', 'Jean Dupont', 'jean@rpc.invalid')$q$);
SELECT pg_temp.login('22222222-2222-4222-8222-222222222222');
SELECT pg_temp.expect_error('create: manager sans fiche', $q$select * from public.create_manual_booking('Gare', 'Hôtel', now() + interval '2 days', 'Jean Dupont', 'jean@rpc.invalid')$q$, '22023', 'Profil chauffeur introuvable. Crée ton profil chauffeur avant de créer une course manuelle.');

SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_error('create: email vide', $q$select * from public.create_manual_booking('Gare', 'Hôtel', now() + interval '2 days', 'Jean Dupont', '')$q$, '22023', 'Email client invalide');
SELECT pg_temp.expect_error('create: email sans @', $q$select * from public.create_manual_booking('Gare', 'Hôtel', now() + interval '2 days', 'Jean Dupont', 'jean.rpc')$q$, '22023', 'Email client invalide');
SELECT pg_temp.expect_sqlstate('create: type foo', $q$select * from public.create_manual_booking('Gare', 'Hôtel', now() + interval '2 days', 'Jean Dupont', 'jean@rpc.invalid', p_booking_type => 'foo')$q$, '22023');
SELECT pg_temp.expect_error('create: montant 100000', $q$select * from public.create_manual_booking('Gare', 'Hôtel', now() + interval '2 days', 'Jean Dupont', 'jean@rpc.invalid', p_manual_total => 100000)$q$, '22023', 'Montant invalide : 100000€');
SELECT pg_temp.expect_error('create: véhicule tenant B', $q$select * from public.create_manual_booking('Gare', 'Hôtel', now() + interval '2 days', 'Jean Dupont', 'jean@rpc.invalid', p_vehicle_id => 'ee000000-0000-4000-8000-0000000000bb')$q$, '22023', 'Véhicule introuvable pour ce tenant');

INSERT INTO _c SELECT 'rule', * FROM public.create_manual_booking('Gare', 'Hôtel', now() + interval '2 days', 'Jean Dupont', '  Client.New@RPC.invalid ', p_distance_km => 30);
INSERT INTO _c SELECT 'rule2', * FROM public.create_manual_booking('Gare', 'Hôtel', now() + interval '2 days', 'Jean Dupont', 'client.new@rpc.invalid', p_distance_km => 30);
INSERT INTO _c SELECT 'manual', * FROM public.create_manual_booking('Gare', 'Hôtel', now() + interval '2 days', 'Jean Dupont', 'client.new@rpc.invalid', p_manual_total => 120);
INSERT INTO _c SELECT 'zero', * FROM public.create_manual_booking('Gare', NULL, now() + interval '2 days', 'Jean Dupont', 'client.new@rpc.invalid', p_manual_total => 0, p_distance_km => 30);

SELECT pg_temp.login('55555555-5555-4555-8555-555555555555');
SELECT pg_temp.expect_error('create: tenant B sans règle', $q$select * from public.create_manual_booking('Gare', 'Hôtel', now() + interval '2 days', 'Paul Martin', 'paul@rpc.invalid')$q$, '22023', 'Aucune règle tarifaire active et aucun montant manuel fourni.');
INSERT INTO _c SELECT 'b_manual', * FROM public.create_manual_booking('Gare', 'Hôtel', now() + interval '2 days', 'Paul Martin', 'paul@rpc.invalid', p_manual_total => 100);
RESET ROLE;

SELECT pg_temp.expect_count('create: retour 70', $q$select count(*) from _c where k = 'rule' and total_price = 70$q$, 1);
SELECT pg_temp.expect_count('create: course règle', $q$select count(*) from public.bookings b join _c on _c.booking_id = b.id where _c.k = 'rule' and b.status = 'accepted' and b.mission_status = 'not_started' and b.pricing_mode = 'direct' and b.booking_source = 'manual_driver' and b.driver_id = 'd0000000-0000-4000-8000-000000000000' and b.vehicle_id = 'ee000000-0000-4000-8000-00000000000a' and b.subtotal_amount = 63.64 and b.vat_amount = 6.36 and b.total_amount = 70 and b.payment_mode = 'cash' and b.current_tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, 1);
SELECT pg_temp.expect_count('create: client normalisé', $q$select count(*) from public.customers where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and email = 'client.new@rpc.invalid' and first_name = 'Jean' and last_name = 'Dupont'$q$, 1);
SELECT pg_temp.expect_count('create: client réutilisé', $q$select count(*) from public.customers where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and email = 'client.new@rpc.invalid'$q$, 1);
SELECT pg_temp.expect_count('create: manuel 120', $q$select count(*) from public.bookings b join _c on _c.booking_id = b.id where _c.k = 'manual' and _c.total_price = 120 and b.pricing_mode = 'manual' and b.total_amount = 120 and b.subtotal_amount = 109.09 and b.vat_amount = 10.91$q$, 1);
SELECT pg_temp.expect_count('create: montant 0 -> règle', $q$select count(*) from public.bookings b join _c on _c.booking_id = b.id where _c.k = 'zero' and b.pricing_mode = 'direct' and _c.total_price = 70 and b.dropoff_address = 'Gare'$q$, 1);
SELECT pg_temp.expect_count('create: tenant B exonéré', $q$select count(*) from public.bookings b join _c on _c.booking_id = b.id where _c.k = 'b_manual' and b.subtotal_amount = 100 and b.vat_amount = 0 and b.vehicle_id = 'ee000000-0000-4000-8000-0000000000bc' and b.driver_id = 'db000000-0000-4000-8000-0000000000bb'$q$, 1);
SELECT pg_temp.expect_count('create: aucun mouvement ledger', 'select count(*) from public.financial_movements', :mvts_avant);
SELECT pg_temp.expect_count('create: marqueur vide', $q$select count(*) from (select 1) x where coalesce(current_setting('vtc.trusted_rpc', true), '') = ''$q$, 1);


-- Instructions du client (plan 14.1-03) ---------------------------------------------
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
INSERT INTO _c SELECT 'instr', * FROM public.create_manual_booking('Gare', 'Hôtel', now() + interval '2 days', 'Jean Dupont', 'client.new@rpc.invalid', p_manual_total => 90, p_instructions => 'Vol AF123, panneau Dupont');
INSERT INTO _c SELECT 'noinstr', * FROM public.create_manual_booking('Gare', 'Hôtel', now() + interval '2 days', 'Jean Dupont', 'client.new@rpc.invalid', p_manual_total => 90);
SELECT pg_temp.expect_ok('instr: owner sur b4 payée', $q$select public.update_booking_instructions('b4000000-0000-4000-8000-000000000004', 'Panneau Martin')$q$);
SELECT pg_temp.expect_ok('instr: owner sur b1', $q$select public.update_booking_instructions('b1000000-0000-4000-8000-000000000001', 'Bagages: 3')$q$);
SELECT pg_temp.expect_error('instr: 501 caractères', $q$select public.update_booking_instructions('b1000000-0000-4000-8000-000000000001', repeat('x', 501))$q$, '23514', 'new row for relation "bookings" violates check constraint "bookings_instructions_check"');
SELECT pg_temp.expect_error('instr: course terminée', $q$select public.update_booking_instructions('b8000000-0000-4000-8000-000000000008', 'X')$q$, '22023', 'Instructions modifiables seulement avant la mission');
SELECT pg_temp.expect_error('instr: UPDATE direct refusé', $q$update public.bookings set instructions = 'X' where id = 'b1000000-0000-4000-8000-000000000001'$q$, '42501', 'permission denied for table bookings');
SELECT pg_temp.login('22222222-2222-4222-8222-222222222222');
SELECT pg_temp.expect_ok('instr: manager', $q$select public.update_booking_instructions('b1000000-0000-4000-8000-000000000001', 'Manager')$q$);
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_ok('instr: driver1 sa course', $q$select public.update_booking_instructions('b1000000-0000-4000-8000-000000000001', 'Vol AF123')$q$);
SELECT pg_temp.login('44444444-4444-4444-8444-444444444444');
SELECT pg_temp.expect_denied('instr: driver2 sur b1', $q$select public.update_booking_instructions('b1000000-0000-4000-8000-000000000001', 'X')$q$);
SELECT pg_temp.login('55555555-5555-4555-8555-555555555555');
SELECT pg_temp.expect_sqlstate('instr: owner B sur b1', $q$select public.update_booking_instructions('b1000000-0000-4000-8000-000000000001', 'X')$q$, 'P0002');
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_ok('instr: espaces -> NULL', $q$select public.update_booking_instructions('b4000000-0000-4000-8000-000000000004', '   ')$q$);
RESET ROLE;
SELECT pg_temp.expect_count('instr: création', $q$select count(*) from public.bookings b join _c on _c.booking_id = b.id where _c.k = 'instr' and b.instructions = 'Vol AF123, panneau Dupont'$q$, 1);
SELECT pg_temp.expect_count('instr: création sans', $q$select count(*) from public.bookings b join _c on _c.booking_id = b.id where _c.k = 'noinstr' and b.instructions is null$q$, 1);
SELECT pg_temp.expect_count('instr: b1 dernière valeur', $q$select count(*) from public.bookings where id = 'b1000000-0000-4000-8000-000000000001' and instructions = 'Vol AF123'$q$, 1);
SELECT pg_temp.expect_count('instr: b4 vide -> NULL', $q$select count(*) from public.bookings where id = 'b4000000-0000-4000-8000-000000000004' and instructions is null$q$, 1);
SELECT pg_temp.expect_count('instr: une seule create_manual_booking', $q$select count(*) from pg_proc where proname = 'create_manual_booking'$q$, 1);
SELECT pg_temp.expect_count('instr: pas de droit UPDATE colonne', $q$select count(*) from (select 1) x where not has_column_privilege('authenticated', 'public.bookings', 'instructions', 'UPDATE')$q$, 1);

DO $$ BEGIN RAISE NOTICE 'RPC booking edit checks passed.'; END $$;

ROLLBACK;
