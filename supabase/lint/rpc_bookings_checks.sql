-- RPC de transition de course (Phase 14, plan 04) : matrice par rôle, idempotence, H-15, ledger.
-- Exécuté en CI sur une base reconstruite, transaction annulée.
-- DECISION-CASH: C1 (plan 14-01) : une course accepted cash passe à completed et encaisse.

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

-- b9 : course carte non payée (accepted).
INSERT INTO public.bookings (id, original_tenant_id, current_tenant_id, customer_id, vehicle_id, driver_id, status,
  payment_mode, pickup_time, mission_status, pickup_address, dropoff_address, total_amount, subtotal_amount,
  vat_amount, booking_type, booking_source, pricing_mode) VALUES
  ('b9000000-0000-4000-8000-000000000009', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1000000-0000-4000-8000-00000000000a', 'ee000000-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-000000000001', 'accepted', 'card', now() + interval '3 days', 'not_started', 'A', 'B', 100, 90.91, 9.09, 'transfer', 'manual_driver', 'direct');

SELECT count(*) AS b6_mvts_avant FROM public.financial_movements WHERE booking_id = 'b6000000-0000-4000-8000-000000000006' \gset

-- Accès ---------------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT pg_temp.expect_denied('terrain: anon', $q$select public.terrain_transition('b1000000-0000-4000-8000-000000000001', 'on_board')$q$);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT pg_temp.login('66666666-6666-4666-8666-666666666666');
SELECT pg_temp.expect_denied('terrain: pending', $q$select public.terrain_transition('b1000000-0000-4000-8000-000000000001', 'on_board')$q$);
SELECT pg_temp.login('55555555-5555-4555-8555-555555555555');
SELECT pg_temp.expect_sqlstate('terrain: owner B sur b1', $q$select public.terrain_transition('b1000000-0000-4000-8000-000000000001', 'on_board')$q$, 'P0002');
SELECT pg_temp.login('44444444-4444-4444-8444-444444444444');
SELECT pg_temp.expect_denied('terrain: driver2 sur b1', $q$select public.terrain_transition('b1000000-0000-4000-8000-000000000001', 'on_board')$q$);
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_denied('terrain: driver1 sur b3 sans chauffeur', $q$select public.terrain_transition('b3000000-0000-4000-8000-000000000003', 'on_board')$q$);
SELECT pg_temp.expect_sqlstate('terrain: action inconnue', $q$select public.terrain_transition('b1000000-0000-4000-8000-000000000001', 'foo')$q$, '22023');

-- H-15 ----------------------------------------------------------------------
SELECT pg_temp.expect_error('terrain: too early', $q$select public.terrain_transition('b1000000-0000-4000-8000-000000000001', 'en_route')$q$, 'P0001', 'Too early');
DO $$
DECLARE d text;
BEGIN
  BEGIN
    PERFORM public.terrain_transition('b1000000-0000-4000-8000-000000000001', 'en_route');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS d = PG_EXCEPTION_DETAIL;
    IF coalesce(d, '') = '' THEN RAISE EXCEPTION 'FAIL [terrain: available_at] DETAIL vide'; END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL [terrain: available_at] erreur attendue';
END $$;

-- Cycle b5 (cash, +10 min) ---------------------------------------------------
SELECT pg_temp.expect_ok('terrain: en_route b5', $q$select public.terrain_transition('b5000000-0000-4000-8000-000000000005', 'en_route')$q$);
SELECT pg_temp.expect_ok('terrain: en_route b5 rejeu', $q$select public.terrain_transition('b5000000-0000-4000-8000-000000000005', 'en_route')$q$);
SELECT pg_temp.expect_ok('terrain: on_board b5', $q$select public.terrain_transition('b5000000-0000-4000-8000-000000000005', 'on_board')$q$);
SELECT pg_temp.expect_ok('terrain: completed b5', $q$select public.terrain_transition('b5000000-0000-4000-8000-000000000005', 'completed')$q$);
SELECT pg_temp.expect_ok('terrain: completed b5 rejeu', $q$select public.terrain_transition('b5000000-0000-4000-8000-000000000005', 'completed')$q$);

-- b6 (paid, carte) terminée avec correction d'heure.
SELECT pg_temp.expect_ok('terrain: completed b6 corrigée', $q$select public.terrain_transition('b6000000-0000-4000-8000-000000000006', 'completed', now() - interval '5 minutes')$q$);
-- b9 (accepted, carte) : pas d'encaissement possible.
SELECT pg_temp.expect_error('terrain: completed b9 carte non payée', $q$select public.terrain_transition('b9000000-0000-4000-8000-000000000009', 'completed')$q$, '22023', 'Paiement non encaissé');

-- Owner et manager sur les courses du tenant.
SELECT pg_temp.login('22222222-2222-4222-8222-222222222222');
SELECT pg_temp.expect_ok('terrain: manager sur b2', $q$select public.terrain_transition('b2000000-0000-4000-8000-000000000002', 'on_board')$q$);
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_ok('terrain: owner sur b1', $q$select public.terrain_transition('b1000000-0000-4000-8000-000000000001', 'on_board')$q$);
RESET ROLE;

-- États (postgres) -------------------------------------------------------------
SELECT pg_temp.expect_count('terrain: marqueur remis à vide', $q$select count(*) from (select 1) x where current_setting('vtc.trusted_rpc', true) = ''$q$, 1);
SELECT pg_temp.expect_count('terrain: b1 note inchangée par Too early', $q$select count(*) from public.bookings where id = 'b1000000-0000-4000-8000-000000000001' and mission_note !~ 'en_route_at'$q$, 1);
SELECT pg_temp.expect_count('terrain: b5 une ligne en_route', $q$select count(*) from regexp_matches((select mission_note from public.bookings where id = 'b5000000-0000-4000-8000-000000000005'), '\[terrain\] en_route_at=', 'g')$q$, 1);
SELECT pg_temp.expect_count('terrain: b5 on_board posé', $q$select count(*) from public.bookings where id = 'b5000000-0000-4000-8000-000000000005' and mission_note ~ '\[terrain\] on_board_at='$q$, 1);
SELECT pg_temp.expect_count('terrain: b5 completed', $q$select count(*) from public.bookings where id = 'b5000000-0000-4000-8000-000000000005' and status = 'completed' and mission_status = 'completed'$q$, 1);
SELECT pg_temp.expect_count('terrain: b5 un seul cash_completion', $q$select count(*) from public.financial_movements where booking_id = 'b5000000-0000-4000-8000-000000000005' and created_by_event = 'cash_completion'$q$, 1);
SELECT pg_temp.expect_count('terrain: b6 completed corrigée', $q$select count(*) from public.bookings where id = 'b6000000-0000-4000-8000-000000000006' and status = 'completed' and mission_note ~ 'completed_at_was_corrected=true'$q$, 1);
SELECT pg_temp.expect_count('terrain: b6 ledger inchangé', $q$select count(*) from public.financial_movements where booking_id = 'b6000000-0000-4000-8000-000000000006'$q$, :b6_mvts_avant);
SELECT pg_temp.expect_count('terrain: b9 inchangée', $q$select count(*) from public.bookings where id = 'b9000000-0000-4000-8000-000000000009' and status = 'accepted' and mission_status = 'not_started'$q$, 1);

DO $$ BEGIN RAISE NOTICE 'RPC bookings checks passed.'; END $$;

ROLLBACK;
