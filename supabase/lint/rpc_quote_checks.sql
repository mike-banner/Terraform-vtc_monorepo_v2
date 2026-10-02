-- Demandes de devis, chevauchement et plafonds de saisie manuelle (Phase 14.1, plan 05).
-- Exécuté en CI sur une base reconstruite, transaction annulée.

\set ON_ERROR_STOP on
\o /dev/null

BEGIN;

\ir _rpc_fixtures.sql

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

CREATE FUNCTION pg_temp.expect_val(label text, query text, expected text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  EXECUTE query INTO v;
  IF v IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'FAIL [%] : % attendu, % obtenu', label, coalesce(expected, 'NULL'), coalesce(v, 'NULL');
  END IF;
END $$;

-- ============================================================================
-- Partie 1 : chevauchement (booking_window, booking_conflicts) et plafonds (D-36, D-40, D-41)
-- ============================================================================

-- Course de test n (postgres) : id e0..0n, tenant A, client A ; d = jours à partir d'aujourd'hui, h = heure.
CREATE FUNCTION pg_temp.eid(n int) RETURNS uuid LANGUAGE sql AS $$
  SELECT ('e0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
CREATE FUNCTION pg_temp.mk(n int, st text, mission text, drv uuid, d int, h numeric, hours numeric, typ text DEFAULT 'transfer')
RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.bookings (id, original_tenant_id, current_tenant_id, customer_id, vehicle_id, driver_id, status,
    payment_mode, pickup_time, mission_status, pickup_address, dropoff_address, total_amount, subtotal_amount,
    vat_amount, booking_type, booking_source, pricing_mode, duration_hours)
  VALUES (pg_temp.eid(n), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'c1000000-0000-4000-8000-00000000000a', 'ee000000-0000-4000-8000-00000000000a', drv, st::public.booking_status,
    'cash', date_trunc('day', now()) + make_interval(days => d) + make_interval(secs => (h * 3600)::int), mission::public.mission_status_enum,
    'Adresse ' || n, 'B', 100, 90.91, 9.09, typ::public.booking_type_enum, 'manual_driver', 'direct', hours) $$;
-- Nombre de lignes de booking_conflicts(sujet) dont l'autre course est other.
CREATE FUNCTION pg_temp.conf(subj int, other int) RETURNS text LANGUAGE sql AS $$
  SELECT count(*)::text FROM public.booking_conflicts(pg_temp.eid(subj)) WHERE other_id = pg_temp.eid(other) $$;

\set d1 '\'d1000000-0000-4000-8000-000000000001\''
\set d2 '\'d2000000-0000-4000-8000-000000000002\''

-- booking_window
SELECT pg_temp.expect_val('window NULL', $q$select booking_window('2030-01-01 10:00+00', NULL)::text$q$, '["2030-01-01 10:00:00+00","2030-01-01 14:00:00+00")');
SELECT pg_temp.expect_val('window 0', $q$select booking_window('2030-01-01 10:00+00', 0)::text$q$, '["2030-01-01 10:00:00+00","2030-01-01 14:00:00+00")');
SELECT pg_temp.expect_val('window 2', $q$select booking_window('2030-01-01 10:00+00', 2)::text$q$, '["2030-01-01 10:00:00+00","2030-01-01 12:00:00+00")');
SELECT pg_temp.expect_val('window négative', $q$select isempty(booking_window('2030-01-01 10:00+00', -5))::text$q$, 'true');
SELECT pg_temp.expect_val('window démesurée', $q$select (upper(booking_window('2030-01-01 10:00+00', 100000)) - '2030-01-01 10:00+00'::timestamptz = interval '8760 hours')::text$q$, 'true');
SELECT pg_temp.expect_val('window: droits', $q$select has_function_privilege('authenticated', 'public.booking_window(timestamptz,numeric)', 'EXECUTE')::text$q$, 'false');
SELECT pg_temp.expect_val('conflicts: droits anon', $q$select has_function_privilege('anon', 'public.booking_conflicts(uuid)', 'EXECUTE')::text$q$, 'false');

-- Scénario 1 (jour 20) : P payé driver1 10:00 sans durée ; R pending hourly non affectée 08:00, 10 h.
SELECT pg_temp.mk(1, 'paid', 'not_started', 'd1000000-0000-4000-8000-000000000001', 20, 10, NULL);
SELECT pg_temp.mk(2, 'pending', 'to_validate', NULL, 20, 8, 10, 'hourly');
-- Scénario 2 (jour 21) : P 10:00-14:00 et sondes pending.
SELECT pg_temp.mk(10, 'paid', 'not_started', 'd1000000-0000-4000-8000-000000000001', 21, 10, NULL);
SELECT pg_temp.mk(11, 'pending', 'to_validate', NULL, 21, 11, 1, 'hourly');
SELECT pg_temp.mk(12, 'pending', 'to_validate', NULL, 21, 13.9833333, 1, 'hourly');   -- 13:59
SELECT pg_temp.mk(13, 'pending', 'to_validate', NULL, 21, 14, 1, 'hourly');
SELECT pg_temp.mk(14, 'pending', 'to_validate', NULL, 21, 9, 1, 'hourly');
SELECT pg_temp.mk(15, 'pending', 'to_validate', NULL, 21, 9, 1.5, 'hourly');
-- Scénario 3 (jours 22) : transferts 09:00 accepté et 14:00 pending ; scénario 3b (jour 23) : 11:00 et 14:00.
SELECT pg_temp.mk(20, 'accepted', 'not_started', NULL, 22, 9, NULL);
SELECT pg_temp.mk(21, 'pending', 'to_validate', NULL, 22, 14, NULL);
SELECT pg_temp.mk(22, 'accepted', 'not_started', NULL, 23, 11, NULL);
SELECT pg_temp.mk(23, 'pending', 'to_validate', NULL, 23, 14, NULL);
-- Scénario 4 (D-36) : semaine non affectée acceptée (jour 30, 168 h), transfert payé au milieu (jour 33 09:00).
SELECT pg_temp.mk(30, 'accepted', 'not_started', NULL, 30, 0, 168, 'hourly');
SELECT pg_temp.mk(31, 'paid', 'not_started', 'd1000000-0000-4000-8000-000000000001', 33, 9, NULL);
-- Scénario 5 : chauffeurs (jour 40 10:00, 2 h).
SELECT pg_temp.mk(40, 'accepted', 'not_started', 'd1000000-0000-4000-8000-000000000001', 40, 10, 2, 'hourly');
SELECT pg_temp.mk(41, 'accepted', 'not_started', 'd2000000-0000-4000-8000-000000000002', 40, 10, 2, 'hourly');
SELECT pg_temp.mk(42, 'accepted', 'not_started', NULL, 40, 10, 2, 'hourly');
-- Scénario 6 : autres statuts hors engagement (jour 45 10:00), sujet pending en face.
SELECT pg_temp.mk(50, 'cancelled_no_refund', 'not_started', NULL, 45, 10, 2, 'hourly');
SELECT pg_temp.mk(51, 'cancelled_refunded', 'not_started', NULL, 45, 10, 2, 'hourly');
SELECT pg_temp.mk(52, 'no_show', 'not_started', NULL, 45, 10, 2, 'hourly');
SELECT pg_temp.mk(53, 'completed', 'completed', NULL, 45, 10, 2, 'hourly');
SELECT pg_temp.mk(54, 'pending', 'to_validate', NULL, 45, 10, 2, 'hourly');
SELECT pg_temp.mk(55, 'pending', 'to_validate', NULL, 45, 10, 2, 'hourly');
-- Tenant B : accepté + pending au même créneau (ne doivent jamais apparaître chez A).
INSERT INTO public.bookings (id, original_tenant_id, current_tenant_id, customer_id, status, payment_mode, pickup_time,
  mission_status, pickup_address, dropoff_address, total_amount, subtotal_amount, vat_amount, booking_type, booking_source, pricing_mode)
SELECT ('eb000000-0000-4000-8000-00000000000' || i)::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'c1000000-0000-4000-8000-00000000000b', (CASE i WHEN 1 THEN 'accepted' ELSE 'paid' END)::public.booking_status, 'cash',
  date_trunc('day', now()) + interval '20 days 10 hours', 'not_started'::public.mission_status_enum, 'AdresseB', 'B', 100, 90.91, 9.09,
  'transfer'::public.booking_type_enum, 'manual_driver', 'direct'
FROM generate_series(1, 2) i;

SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');

-- Scénario 1
SELECT pg_temp.expect_val('conf: R voit P', $q$select pg_temp.conf(2, 1)$q$, '1');
SELECT pg_temp.expect_val('conf: P ne voit pas R pending', $q$select pg_temp.conf(1, 2)$q$, '0');
RESET ROLE;
UPDATE public.bookings SET status = 'accepted' WHERE id = pg_temp.eid(2);
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_val('conf: R accepted voit P', $q$select pg_temp.conf(2, 1)$q$, '1');
SELECT pg_temp.expect_val('conf: P voit R accepted', $q$select pg_temp.conf(1, 2)$q$, '1');
-- Scénario 2 : demi-journée de 4 h
SELECT pg_temp.expect_val('4h: 11:00 conflit', $q$select pg_temp.conf(11, 10)$q$, '1');
SELECT pg_temp.expect_val('4h: 13:59 conflit', $q$select pg_temp.conf(12, 10)$q$, '1');
SELECT pg_temp.expect_val('4h: 14:00 bout à bout', $q$select pg_temp.conf(13, 10)$q$, '0');
SELECT pg_temp.expect_val('4h: 09:00-10:00 aucun', $q$select pg_temp.conf(14, 10)$q$, '0');
SELECT pg_temp.expect_val('4h: 09:00-10:30 conflit', $q$select pg_temp.conf(15, 10)$q$, '1');
-- Scénario 3
SELECT pg_temp.expect_val('4h: 09:00 / 14:00 aucun', $q$select pg_temp.conf(21, 20)$q$, '0');
SELECT pg_temp.expect_val('4h: 11:00 / 14:00 conflit', $q$select pg_temp.conf(23, 22)$q$, '1');
-- Scénario 4 (D-36)
SELECT pg_temp.expect_val('semaine: T voit M', $q$select pg_temp.conf(31, 30)$q$, '1');
SELECT pg_temp.expect_val('semaine: M voit T', $q$select pg_temp.conf(30, 31)$q$, '1');
-- Scénario 5
SELECT pg_temp.expect_val('chauffeurs: E1/E2', $q$select pg_temp.conf(40, 41)$q$, '0');
SELECT pg_temp.expect_val('chauffeurs: E2/E1', $q$select pg_temp.conf(41, 40)$q$, '0');
SELECT pg_temp.expect_val('chauffeurs: E1/E3', $q$select pg_temp.conf(40, 42)$q$, '1');
SELECT pg_temp.expect_val('chauffeurs: E2/E3', $q$select pg_temp.conf(41, 42)$q$, '1');
SELECT pg_temp.expect_val('chauffeurs: E3/E1', $q$select pg_temp.conf(42, 40)$q$, '1');
-- Scénario 6
SELECT pg_temp.expect_val('statuts: annulé', $q$select pg_temp.conf(54, 50)$q$, '0');
SELECT pg_temp.expect_val('statuts: remboursé', $q$select pg_temp.conf(54, 51)$q$, '0');
SELECT pg_temp.expect_val('statuts: no_show', $q$select pg_temp.conf(54, 52)$q$, '0');
SELECT pg_temp.expect_val('statuts: terminé', $q$select pg_temp.conf(54, 53)$q$, '0');
SELECT pg_temp.expect_val('statuts: pending', $q$select pg_temp.conf(54, 55)$q$, '0');
-- Sans argument
SELECT pg_temp.expect_val('tous: aucun tenant B', $q$select count(*)::text from public.booking_conflicts() c join public.bookings b on b.id = c.booking_id where b.current_tenant_id <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, '0');
SELECT pg_temp.expect_val('tous: contient P/R', $q$select count(*)::text from public.booking_conflicts() where booking_id = pg_temp.eid(1) and other_id = pg_temp.eid(2)$q$, '1');
SELECT pg_temp.expect_val('tous: other_end_time', $q$select (other_end_time - other_pickup_time)::text from public.booking_conflicts(pg_temp.eid(2)) where other_id = pg_temp.eid(1)$q$, '04:00:00');
-- Rôles
SELECT pg_temp.login('55555555-5555-4555-8555-555555555555');
SELECT pg_temp.expect_val('owner B: ses paires', $q$select count(*)::text from public.booking_conflicts() where booking_id = 'eb000000-0000-4000-8000-000000000002'::uuid and other_id = 'eb000000-0000-4000-8000-000000000001'::uuid$q$, '1');
SELECT pg_temp.expect_val('owner B: aucune ligne de A', $q$select count(*)::text from public.booking_conflicts() where booking_id::text like 'e0%'$q$, '0');
SELECT pg_temp.expect_sqlstate('owner B: course de A', $q$select * from public.booking_conflicts(pg_temp.eid(1))$q$, 'P0002');
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_sqlstate('id inconnu', $q$select * from public.booking_conflicts('99999999-9999-4999-8999-999999999999')$q$, 'P0002');
SELECT pg_temp.expect_sqlstate('course de B par owner A', $q$select * from public.booking_conflicts('eb000000-0000-4000-8000-000000000001')$q$, 'P0002');
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_sqlstate('driver1', $q$select * from public.booking_conflicts()$q$, '42501');
SELECT pg_temp.login('22222222-2222-4222-8222-222222222222');
SELECT pg_temp.expect_ok('manager A', $q$select * from public.booking_conflicts()$q$);
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT pg_temp.expect_sqlstate('anon', $q$select * from public.booking_conflicts()$q$, '42501');
RESET ROLE;

-- Plafonds D-41 et durée ------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_val('update 99999', $q$select public.update_booking_details('b1000000-0000-4000-8000-000000000001', (select pickup_time from public.bookings where id = 'b1000000-0000-4000-8000-000000000001'), 'A', NULL, NULL, NULL, 99999)::text$q$, '99999');
SELECT pg_temp.expect_sqlstate('update 100000', $q$select public.update_booking_details('b1000000-0000-4000-8000-000000000001', now() + interval '3 days', 'A', NULL, NULL, NULL, 100000)$q$, '22023');
SELECT pg_temp.expect_sqlstate('update 0', $q$select public.update_booking_details('b1000000-0000-4000-8000-000000000001', now() + interval '3 days', 'A', NULL, NULL, NULL, 0)$q$, '22023');
SELECT pg_temp.expect_sqlstate('update durée -1', $q$select public.update_booking_details('b1000000-0000-4000-8000-000000000001', now() + interval '3 days', 'A', NULL, NULL, -1)$q$, '22023');
SELECT pg_temp.expect_sqlstate('update durée 8761', $q$select public.update_booking_details('b1000000-0000-4000-8000-000000000001', now() + interval '3 days', 'A', NULL, NULL, 8761)$q$, '22023');
SELECT pg_temp.expect_ok('update durée 8760', $q$select public.update_booking_details('b1000000-0000-4000-8000-000000000001', now() + interval '3 days', 'A', NULL, NULL, 8760)$q$);
SELECT pg_temp.expect_ok('update durée 0', $q$select public.update_booking_details('b1000000-0000-4000-8000-000000000001', now() + interval '3 days', 'A', NULL, NULL, 0)$q$);
SELECT pg_temp.expect_ok('update durée NULL', $q$select public.update_booking_details('b1000000-0000-4000-8000-000000000001', now() + interval '3 days', 'A', NULL, NULL, NULL)$q$);
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_sqlstate('update driver1 + montant', $q$select public.update_booking_details('b1000000-0000-4000-8000-000000000001', now() + interval '3 days', 'A', NULL, NULL, NULL, 50)$q$, '42501');
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_ok('create 99999', $q$select public.create_manual_booking('Gare', 'Hôtel', now() + interval '60 days', 'Cli Un', 'cli1@x.invalid', 'cash', 99999)$q$);
SELECT pg_temp.expect_error('create 100000', $q$select public.create_manual_booking('Gare', 'Hôtel', now() + interval '60 days', 'Cli Un', 'cli1@x.invalid', 'cash', 100000)$q$, '22023', 'Montant invalide : 100000€');
SELECT pg_temp.expect_ok('create durée 8760', $q$select public.create_manual_booking('Gare', 'Hôtel', now() + interval '60 days', 'Cli Un', 'cli1@x.invalid', 'cash', 500, 'hourly', NULL, 8760)$q$);
SELECT pg_temp.expect_sqlstate('create durée 8761', $q$select public.create_manual_booking('Gare', 'Hôtel', now() + interval '60 days', 'Cli Un', 'cli1@x.invalid', 'cash', 500, 'hourly', NULL, 8761)$q$, '22023');
SELECT pg_temp.expect_sqlstate('create durée -1', $q$select public.create_manual_booking('Gare', 'Hôtel', now() + interval '60 days', 'Cli Un', 'cli1@x.invalid', 'cash', 500, 'hourly', NULL, -1)$q$, '22023');
SELECT pg_temp.expect_val('create 200 h calcul serveur', $q$select total_price::text from public.create_manual_booking('Gare', 'Hôtel', now() + interval '60 days', 'Cli Un', 'cli1@x.invalid', 'cash', NULL, 'hourly', NULL, 200)$q$, '10010.00');
RESET ROLE;

-- ============================================================================
-- Partie 2 : demandes (submit_booking_request), acceptation manuelle et refus (D-34 à D-37)
-- ============================================================================

CREATE FUNCTION pg_temp.expect_like(label text, stmt text, code text, pattern text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = code AND SQLERRM LIKE pattern THEN RETURN; END IF;
    RAISE EXCEPTION 'FAIL [%] : % / % attendu, % / % obtenu', label, code, pattern, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'FAIL [%] : erreur % attendue, instruction acceptée', label, code;
END $$;

CREATE FUNCTION pg_temp.sbr(kind text, st timestamptz, en timestamptz, email text,
  tenant uuid DEFAULT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', veh uuid DEFAULT 'ee000000-0000-4000-8000-00000000000a',
  instr text DEFAULT 'Vol AF1', first text DEFAULT 'Ana')
RETURNS boolean LANGUAGE sql AS $$
  SELECT public.submit_booking_request(tenant, kind, 'Gare', '', st, en, 2, 1, veh, first, 'B', email, '0600000000', instr) $$;
-- Dernière demande d'un e-mail (postgres).
CREATE FUNCTION pg_temp.bid(p_email text) RETURNS uuid LANGUAGE sql AS $$
  SELECT b.id FROM public.bookings b JOIN public.customers c ON c.id = b.customer_id WHERE c.email = lower(p_email)
  ORDER BY b.created_at DESC LIMIT 1 $$;
CREATE FUNCTION pg_temp.bv(email text, expr text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  EXECUTE format('select (%s)::text from public.bookings b where b.id = pg_temp.bid(%L)', expr, email) INTO v;
  RETURN v;
END $$;

-- Véhicule du tenant B (pour le refus d'un véhicule d'un autre tenant).
INSERT INTO public.vehicles (id, tenant_id, driver_id, category, brand, model, plate_number) VALUES
  ('ee000000-0000-4000-8000-0000000000bb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', NULL, 'berline', 'Test', 'B1', 'RPC-B-001');

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);

SELECT pg_temp.expect_val('mad: true', $q$select pg_temp.sbr('mise_a_disposition', now() + interval '1 day', now() + interval '1 day 4 hours', 'a1@x.invalid')::text$q$, 'true');
SELECT pg_temp.expect_val('mad: 25 h', $q$select pg_temp.sbr('mise_a_disposition', now() + interval '1 day', now() + interval '2 days 1 hour', 'a25@x.invalid')::text$q$, 'true');
SELECT pg_temp.expect_val('mad: 168 h', $q$select pg_temp.sbr('mise_a_disposition', now() + interval '1 day', now() + interval '8 days', 'a168@x.invalid')::text$q$, 'true');
SELECT pg_temp.expect_val('mad: 200 h', $q$select pg_temp.sbr('mise_a_disposition', now() + interval '1 day', now() + interval '1 day 200 hours', 'a200@x.invalid')::text$q$, 'true');
SELECT pg_temp.expect_val('mad: 8760 h', $q$select pg_temp.sbr('mise_a_disposition', now() + interval '1 day', now() + interval '1 day 8760 hours', 'a8760@x.invalid')::text$q$, 'true');
SELECT pg_temp.expect_val('mad: 1,5 h', $q$select pg_temp.sbr('mise_a_disposition', now() + interval '1 day', now() + interval '1 day 90 minutes', 'a15@x.invalid')::text$q$, 'true');
SELECT pg_temp.expect_sqlstate('mad: 8761 h', $q$select pg_temp.sbr('mise_a_disposition', now() + interval '1 day', now() + interval '1 day 8761 hours', 'e1@x.invalid')$q$, '22023');
SELECT pg_temp.expect_sqlstate('mad: 0,5 h', $q$select pg_temp.sbr('mise_a_disposition', now() + interval '1 day', now() + interval '1 day 30 minutes', 'e2@x.invalid')$q$, '22023');
SELECT pg_temp.expect_sqlstate('mad: fin = début', $q$select pg_temp.sbr('mise_a_disposition', now() + interval '1 day', now() + interval '1 day', 'e3@x.invalid')$q$, '22023');
SELECT pg_temp.expect_sqlstate('mad: fin avant début', $q$select pg_temp.sbr('mise_a_disposition', now() + interval '1 day', now() + interval '1 hour', 'e4@x.invalid')$q$, '22023');
SELECT pg_temp.expect_sqlstate('mad: fin NULL', $q$select pg_temp.sbr('mise_a_disposition', now() + interval '1 day', NULL, 'e5@x.invalid')$q$, '22023');
SELECT pg_temp.expect_val('tenant B sans règle', $q$select pg_temp.sbr('mise_a_disposition', now() + interval '1 day', now() + interval '1 day 4 hours', 'b1@x.invalid', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', NULL)::text$q$, 'true');
SELECT pg_temp.expect_val('ld: avec fin', $q$select pg_temp.sbr('longue_distance', now() + interval '2 days', now() + interval '3 days', 'ld1@x.invalid', instr => 'Lyon-Nice')::text$q$, 'true');
SELECT pg_temp.expect_val('ld: sans fin', $q$select pg_temp.sbr('longue_distance', now() + interval '2 days', NULL, 'ld2@x.invalid')::text$q$, 'true');
SELECT pg_temp.expect_sqlstate('business refusé', $q$select pg_temp.sbr('business', now() + interval '2 days', NULL, 'e6@x.invalid')$q$, '22023');
SELECT pg_temp.expect_sqlstate('foo refusé', $q$select pg_temp.sbr('foo', now() + interval '2 days', NULL, 'e7@x.invalid')$q$, '22023');
-- Client existant : aucune modification
SELECT pg_temp.expect_val('client existant', $q$select pg_temp.sbr('mise_a_disposition', now() + interval '1 day', now() + interval '1 day 4 hours', 'client-a@rpc.invalid', first => 'Zed')::text$q$, 'true');
-- Bornes
SELECT pg_temp.expect_sqlstate('heure +1 h', $q$select pg_temp.sbr('mise_a_disposition', now() + interval '1 hour', now() + interval '6 hours', 'e8@x.invalid')$q$, '22023');
SELECT pg_temp.expect_sqlstate('début +3 ans', $q$select pg_temp.sbr('mise_a_disposition', now() + interval '3 years', now() + interval '3 years 4 hours', 'e9@x.invalid')$q$, '22023');
SELECT pg_temp.expect_error('tenant inconnu', $q$select pg_temp.sbr('mise_a_disposition', now() + interval '1 day', now() + interval '1 day 4 hours', 'e10@x.invalid', '99999999-9999-4999-8999-999999999999')$q$, '22023', 'Demande impossible');
SELECT pg_temp.expect_sqlstate('véhicule de B', $q$select pg_temp.sbr('mise_a_disposition', now() + interval '1 day', now() + interval '1 day 4 hours', 'e11@x.invalid', veh => 'ee000000-0000-4000-8000-0000000000bb')$q$, '22023');
SELECT pg_temp.expect_sqlstate('e-mail invalide', $q$select pg_temp.sbr('mise_a_disposition', now() + interval '1 day', now() + interval '1 day 4 hours', 'pas-un-email')$q$, '22023');
SELECT pg_temp.expect_val('instructions 600', $q$select pg_temp.sbr('mise_a_disposition', now() + interval '1 day', now() + interval '1 day 4 hours', 'long@x.invalid', instr => repeat('x', 600))::text$q$, 'true');
-- D-37 : aucune vérification de disponibilité (b4 payée à +3 jours)
SELECT pg_temp.expect_val('chevauchement toléré', $q$select pg_temp.sbr('mise_a_disposition', now() + interval '3 days', now() + interval '3 days 4 hours', 'ov@x.invalid')::text$q$, 'true');
-- Limite par e-mail : 3 puis refus
SELECT pg_temp.sbr('mise_a_disposition', now() + interval '1 day', now() + interval '1 day 4 hours', 'rl@x.invalid');
SELECT pg_temp.sbr('mise_a_disposition', now() + interval '1 day', now() + interval '1 day 4 hours', 'rl@x.invalid');
SELECT pg_temp.sbr('mise_a_disposition', now() + interval '1 day', now() + interval '1 day 4 hours', 'rl@x.invalid');
SELECT pg_temp.expect_error('4e demande', $q$select pg_temp.sbr('mise_a_disposition', now() + interval '1 day', now() + interval '1 day 4 hours', 'rl@x.invalid')$q$, '22023', 'Trop de demandes, réessayez plus tard');
-- Droits
SELECT pg_temp.expect_denied('anon: accept_quote_manually', $q$select public.accept_quote_manually('b3000000-0000-4000-8000-000000000003')$q$);
SELECT pg_temp.expect_denied('anon: authorize_quote', $q$select public.authorize_quote('b3000000-0000-4000-8000-000000000003')$q$);
SELECT pg_temp.expect_denied('anon: decline', $q$select public.decline_booking_request('b3000000-0000-4000-8000-000000000003', 'x')$q$);
SELECT pg_temp.expect_denied('anon: booking_conflicts', $q$select * from public.booking_conflicts()$q$);
RESET ROLE;

-- Vérifications des lignes créées (postgres)
SELECT pg_temp.expect_val('a1: statut', $q$select pg_temp.bv('a1@x.invalid', 'b.status::text || b.mission_status::text || b.booking_source || b.payment_mode::text || b.booking_type::text || b.pricing_mode::text')$q$, 'pendingto_validatecustomercashhourlydirect');
SELECT pg_temp.expect_val('a1: durée', $q$select pg_temp.bv('a1@x.invalid', 'b.duration_hours')$q$, '4.00');
SELECT pg_temp.expect_val('a1: total', $q$select pg_temp.bv('a1@x.invalid', 'b.total_amount')$q$, '210.00');
SELECT pg_temp.expect_val('a1: HT+TVA', $q$select pg_temp.bv('a1@x.invalid', 'b.subtotal_amount + b.vat_amount = b.total_amount')$q$, 'true');
SELECT pg_temp.expect_val('a1: instructions', $q$select pg_temp.bv('a1@x.invalid', $e$b.instructions like 'Mise à disposition — Vol AF1'$e$)$q$, 'true');
SELECT pg_temp.expect_val('a1: politique', $q$select pg_temp.bv('a1@x.invalid', 'b.cancellation_policy_id is not null')$q$, 'true');
SELECT pg_temp.expect_val('25 h', $q$select pg_temp.bv('a25@x.invalid', 'b.duration_hours')$q$, '25.00');
SELECT pg_temp.expect_val('168 h', $q$select pg_temp.bv('a168@x.invalid', 'b.total_amount')$q$, '8410.00');
SELECT pg_temp.expect_val('200 h', $q$select pg_temp.bv('a200@x.invalid', 'b.total_amount')$q$, '10010.00');
SELECT pg_temp.expect_val('8760 h', $q$select pg_temp.bv('a8760@x.invalid', 'b.duration_hours')$q$, '8760.00');
SELECT pg_temp.expect_val('1,5 h', $q$select pg_temp.bv('a15@x.invalid', 'b.duration_hours')$q$, '1.50');
SELECT pg_temp.expect_val('B: total 0 manuel', $q$select pg_temp.bv('b1@x.invalid', 'b.total_amount || b.pricing_mode::text')$q$, '0.00manual');
SELECT pg_temp.expect_val('ld1', $q$select pg_temp.bv('ld1@x.invalid', 'b.booking_type::text || coalesce(b.duration_hours::text, ''NULL'') || b.total_amount || b.pricing_mode::text')$q$, 'transferNULL0.00manual');
SELECT pg_temp.expect_val('ld1 préfixe', $q$select pg_temp.bv('ld1@x.invalid', $e$b.instructions = 'Longue distance — Lyon-Nice'$e$)$q$, 'true');
SELECT pg_temp.expect_val('ld2', $q$select pg_temp.bv('ld2@x.invalid', 'b.booking_type::text || coalesce(b.duration_hours::text, ''NULL'')')$q$, 'transferNULL');
SELECT pg_temp.expect_val('client existant inchangé', $q$select first_name from public.customers where email = 'client-a@rpc.invalid' and tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$q$, 'ClientA');
SELECT pg_temp.expect_val('client existant: demande rattachée', $q$select count(*)::text from public.bookings where customer_id = 'c1000000-0000-4000-8000-00000000000a' and booking_source = 'customer'$q$, '1');
SELECT pg_temp.expect_val('instructions tronquées', $q$select pg_temp.bv('long@x.invalid', 'char_length(b.instructions)')$q$, '500');
SELECT pg_temp.expect_val('chevauchement toléré: créée', $q$select pg_temp.bv('ov@x.invalid', 'b.status::text')$q$, 'pending');

-- Tenant suspendu : même message
UPDATE public.tenants SET status = 'suspended' WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT pg_temp.expect_error('tenant suspendu', $q$select pg_temp.sbr('mise_a_disposition', now() + interval '1 day', now() + interval '1 day 4 hours', 'e12@x.invalid', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', NULL)$q$, '22023', 'Demande impossible');
SELECT pg_temp.expect_count('anon: aucune lecture de bookings', $q$select count(*) from public.bookings$q$, 0);
RESET ROLE;
UPDATE public.tenants SET status = 'active' WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

-- authorize_quote, accept_quote_manually, decline_booking_request ---------------
SELECT pg_temp.mk(60, 'pending', 'to_validate', 'd2000000-0000-4000-8000-000000000002', 50, 10, 2, 'hourly');
SELECT pg_temp.mk(61, 'accepted', 'not_started', 'd1000000-0000-4000-8000-000000000001', 50, 10, 2, 'hourly');
SELECT pg_temp.mk(62, 'pending', 'to_validate', NULL, 50, 12, 2, 'hourly');

SET LOCAL ROLE authenticated;
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_sqlstate('authorize: driver1', $$select public.authorize_quote(pg_temp.bid('a1@x.invalid'))$$, '42501');
SELECT pg_temp.expect_sqlstate('accept: driver1', $$select public.accept_quote_manually(pg_temp.bid('a1@x.invalid'))$$, '42501');
SELECT pg_temp.expect_sqlstate('decline: driver1', $$select public.decline_booking_request(pg_temp.bid('a1@x.invalid'), 'x')$$, '42501');
SELECT pg_temp.login('55555555-5555-4555-8555-555555555555');
SELECT pg_temp.expect_sqlstate('authorize: owner B', $$select public.authorize_quote(pg_temp.bid('a1@x.invalid'))$$, 'P0002');
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_ok('authorize: owner A, prix pré-rempli', $$select public.authorize_quote(pg_temp.bid('a1@x.invalid'))$$);
SELECT pg_temp.expect_error('authorize: total 0', $$select public.authorize_quote(pg_temp.bid('ld1@x.invalid'))$$, '22023', 'Fixer le prix avant le devis');
SELECT pg_temp.expect_sqlstate('authorize: course acceptée', $q$select public.authorize_quote('b1000000-0000-4000-8000-000000000001')$q$, '22023');
SELECT pg_temp.expect_ok('prix fixé par le propriétaire', $$select public.update_booking_details(pg_temp.bid('ld1@x.invalid'), now() + interval '2 days', 'Gare', NULL, NULL, NULL, 180)$$);
SELECT pg_temp.expect_ok('authorize: après prix', $$select public.authorize_quote(pg_temp.bid('ld1@x.invalid'))$$);
-- accept
SELECT pg_temp.expect_error('accept: total 0', $$select public.accept_quote_manually(pg_temp.bid('ld2@x.invalid'))$$, '22023', 'Fixer le prix avant d''accepter');
SELECT pg_temp.expect_val('accept: sans conflit', $$select public.accept_quote_manually(pg_temp.bid('a1@x.invalid'))$$, 'accepted');
SELECT pg_temp.expect_val('accept: rejeu', $$select public.accept_quote_manually(pg_temp.bid('a1@x.invalid'))$$, 'accepted');
-- Conflit : demande à +3 jours + 1 h, recouvre b1 (accepted) et b4 (paid)
SELECT pg_temp.expect_ok('demande sur engagement', $$select public.update_booking_details(pg_temp.bid('ov@x.invalid'), (select pickup_time from public.bookings where id = 'b1000000-0000-4000-8000-000000000001') + interval '1 hour', 'Gare')$$);
SELECT pg_temp.expect_like('accept: conflit', $$select public.accept_quote_manually(pg_temp.bid('ov@x.invalid'))$$, '22023', 'Conflit de créneau : __/__/____ __:__ (A)%');
RESET ROLE;
SELECT pg_temp.expect_val('conflit: reste pending', $q$select pg_temp.bv('ov@x.invalid', 'b.status::text')$q$, 'pending');
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_val('accept: p_force', $$select public.accept_quote_manually(pg_temp.bid('ov@x.invalid'), true)$$, 'accepted');
-- Autre chauffeur affecté : pas de conflit ; bout à bout : pas de conflit
SELECT pg_temp.expect_val('accept: autre chauffeur', $$select public.accept_quote_manually(pg_temp.eid(60))$$, 'accepted');
SELECT pg_temp.expect_val('accept: bout à bout', $$select public.accept_quote_manually(pg_temp.eid(62))$$, 'accepted');
-- decline
SELECT pg_temp.login('22222222-2222-4222-8222-222222222222');
SELECT pg_temp.expect_sqlstate('decline: raison vide', $$select public.decline_booking_request(pg_temp.bid('a25@x.invalid'), '  ')$$, '22023');
SELECT pg_temp.expect_val('decline: manager', $$select public.decline_booking_request(pg_temp.bid('a25@x.invalid'), 'Indisponible')$$, 'cancelled_no_refund');
RESET ROLE;
SELECT pg_temp.expect_val('decline: note', $q$select pg_temp.bv('a25@x.invalid', 'b.cancellation_note')$q$, 'Indisponible');
SELECT pg_temp.expect_val('accept: note force', $q$select pg_temp.bv('ov@x.invalid', $e$b.mission_note like '%conflit confirmé%'$e$)$q$, 'true');

-- Limite par tenant : 30 demandes pending sur 24 h
SELECT count(*) AS n_pending FROM public.bookings WHERE current_tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND booking_source = 'customer' AND status = 'pending' \gset
INSERT INTO public.customers (tenant_id, email, first_name)
SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bulk' || i || '@x.invalid', 'Bulk' FROM generate_series(1, 40) i;
INSERT INTO public.bookings (original_tenant_id, current_tenant_id, customer_id, status, payment_mode, pickup_time,
  mission_status, pickup_address, dropoff_address, total_amount, subtotal_amount, vat_amount, booking_type, booking_source, pricing_mode)
SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', c.id, 'pending', 'cash', now() + interval '300 days',
  'to_validate', 'X', 'X', 0, 0, 0, 'transfer', 'customer', 'manual'
FROM (SELECT id FROM public.customers WHERE email LIKE 'bulk%@x.invalid' ORDER BY email LIMIT (30 - :n_pending)) c;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT pg_temp.expect_error('31e du tenant', $q$select pg_temp.sbr('mise_a_disposition', now() + interval '1 day', now() + interval '1 day 4 hours', 'tenant31@x.invalid')$q$, '22023', 'Trop de demandes, réessayez plus tard');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'RPC quote checks passed.'; END $$;

ROLLBACK;
