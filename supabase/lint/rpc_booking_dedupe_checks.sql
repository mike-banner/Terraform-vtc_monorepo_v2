-- Anti-doublon du webhook Stripe : un paiement ne crée qu'une course (Phase 14.1).
-- Exécuté en CI sur une base reconstruite, transaction annulée.

\set ON_ERROR_STOP on
\o /dev/null

BEGIN;

\ir _rpc_fixtures.sql

-- Même moment, même colonnes que la création d'une course payée par le webhook.
CREATE FUNCTION pg_temp.ins(id uuid, pi text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.bookings (id, original_tenant_id, current_tenant_id, customer_id, vehicle_id, driver_id, status,
    payment_mode, pickup_time, mission_status, pickup_address, dropoff_address, total_amount, subtotal_amount,
    vat_amount, booking_type, booking_source, pricing_mode, stripe_payment_intent_id)
  VALUES (id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'c1000000-0000-4000-8000-00000000000a', 'ee000000-0000-4000-8000-00000000000a',
    'd1000000-0000-4000-8000-000000000001', 'paid', 'stripe', now() + interval '3 days', 'to_validate',
    'A', 'B', 100, 100, 0, 'transfer', 'customer', 'direct', pi);
$$;

SELECT pg_temp.ins('b9d00000-0000-4000-8000-000000000001', 'pi_dedupe_1');
SELECT pg_temp.expect_sqlstate('doublon: même paiement refusé',
  $q$select pg_temp.ins('b9d00000-0000-4000-8000-000000000002', 'pi_dedupe_1')$q$, '23505');

-- Les courses sans paiement Stripe (cash, manuelles) restent illimitées.
SELECT pg_temp.ins('b9d00000-0000-4000-8000-000000000003', NULL);
SELECT pg_temp.ins('b9d00000-0000-4000-8000-000000000004', NULL);
SELECT pg_temp.expect_count('doublon: une seule course par paiement',
  $q$select count(*) from public.bookings where stripe_payment_intent_id = 'pi_dedupe_1'$q$, 1);

DO $$ BEGIN RAISE NOTICE 'Booking dedupe checks passed.'; END $$;

ROLLBACK;
