-- Socle des RPC de la Phase 14 (ADR-012) : le marqueur vtc.trusted_rpc, posé par un client,
-- ne doit rien ouvrir. Exécuté en CI sur une base reconstruite, transaction annulée.

\set ON_ERROR_STOP on
\o /dev/null

BEGIN;

\ir _rpc_fixtures.sql

SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');  -- owner A, rôle tenant le plus large
SELECT set_config('vtc.trusted_rpc', 'on', true);               -- forge du marqueur
SELECT pg_temp.expect_denied('forge: insert ledger', $q$insert into public.financial_movements (booking_id, tenant_id, movement_type, direction, gross_amount, net_amount) values ('b1000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','payment','credit',1,1)$q$);
SELECT pg_temp.expect_denied('forge: insert course payée', $q$insert into public.bookings (original_tenant_id, current_tenant_id, customer_id, pickup_address, dropoff_address, pickup_time, total_amount, subtotal_amount, payment_mode, booking_type, booking_source, pricing_mode, status) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','c1000000-0000-4000-8000-00000000000a','A','B',now()+interval '1 day',1,1,'card','transfer','manual_driver','direct','paid')$q$);
SELECT pg_temp.expect_denied('forge: mission completed cash', $q$update public.bookings set mission_status = 'completed' where id = 'b1000000-0000-4000-8000-000000000001'$q$);
SELECT pg_temp.expect_denied('forge: status paid', $q$update public.bookings set status = 'paid' where id = 'b1000000-0000-4000-8000-000000000001'$q$);
SELECT pg_temp.expect_denied('forge: total_amount', $q$update public.bookings set total_amount = 1 where id = 'b1000000-0000-4000-8000-000000000001'$q$);
RESET ROLE;
SELECT pg_temp.expect_count('forge: ledger inchangé', $q$select count(*) from public.financial_movements where booking_id = 'b1000000-0000-4000-8000-000000000001'$q$, 0);

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT set_config('vtc.trusted_rpc', 'on', true);
SELECT pg_temp.expect_denied('forge anon: insert ledger', $q$insert into public.financial_movements (booking_id, tenant_id, movement_type, direction, gross_amount, net_amount) values ('b1000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','payment','credit',1,1)$q$);
RESET ROLE;

-- Non-régression : sans marqueur, le trigger d'immuabilité bloque toujours postgres.
SELECT set_config('vtc.trusted_rpc', '', true);
DO $$
BEGIN
  BEGIN
    UPDATE public.bookings SET total_amount = 1 WHERE id = 'b1000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Booking immutable after pending status' THEN RAISE; END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL [socle] : protect_booking_immutable_fields ne bloque plus sans marqueur';
END $$;

DO $$ BEGIN RAISE NOTICE 'RPC socle checks passed.'; END $$;

ROLLBACK;
