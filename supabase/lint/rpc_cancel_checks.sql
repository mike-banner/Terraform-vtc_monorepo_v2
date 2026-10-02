-- Annulation / remboursement (phase 14.1, plan 01) : politique par tenant, aperçu, annulation, ledger.
-- Transaction annulée.
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

-- ===== Politique par défaut et rattachement ====================================================
SELECT pg_temp.expect_count('policy: 1 active par tenant fixture',
  $q$select count(*) from public.cancellation_policies where active and version = 1 and hours_before_full_refund = 24
     and hours_before_partial_refund = 2 and partial_refund_rate = 0.5 and no_show_refund_rate = 0
     and driver_fault_refund_rate = 1 and tenant_id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$q$, 2);
SELECT pg_temp.expect_count('policy: courses rattachées',
  $q$select count(*) from public.bookings b join public.cancellation_policies p on p.id = b.cancellation_policy_id
     and p.tenant_id = b.current_tenant_id and p.active$q$, 9);
INSERT INTO public.tenants (id, name, primary_domain, legal_form, setup_completed)
  VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'RPC Test C', 'rpc-test-c.invalid', 'sasu', true);
SELECT pg_temp.expect_count('policy: tenant C',
  $q$select count(*) from public.cancellation_policies where tenant_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' and active and version = 1$q$, 1);

-- ===== update_cancellation_policy ===============================================================
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('22222222-2222-4222-8222-222222222222');
SELECT pg_temp.expect_denied('policy: manager', $q$select public.update_cancellation_policy(48, 4, 0.3, 0.1, 1)$q$);
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_denied('policy: driver', $q$select public.update_cancellation_policy(48, 4, 0.3, 0.1, 1)$q$);
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_error('policy: partiel > total', $q$select public.update_cancellation_policy(4, 48, 0.3, 0.1, 1)$q$, '22023', 'Politique invalide');
SELECT pg_temp.expect_error('policy: taux 1.5', $q$select public.update_cancellation_policy(48, 4, 1.5, 0.1, 1)$q$, '22023', 'Politique invalide');
SELECT pg_temp.expect_error('policy: taux négatif', $q$select public.update_cancellation_policy(48, 4, 0.3, -0.1, 1)$q$, '22023', 'Politique invalide');
SELECT pg_temp.expect_ok('policy: owner met à jour', $q$select public.update_cancellation_policy(48, 4, 0.3, 0.1, 1)$q$);
SELECT pg_temp.expect_count('policy: owner A voit 2 versions', 'select count(*) from public.cancellation_policies', 2);
SELECT pg_temp.login('55555555-5555-4555-8555-555555555555');
SELECT pg_temp.expect_count('policy: owner B voit la sienne', 'select count(*) from public.cancellation_policies', 1);
SELECT pg_temp.expect_denied('policy: INSERT direct', $q$insert into public.cancellation_policies (tenant_id, version, hours_before_full_refund, hours_before_partial_refund, partial_refund_rate, no_show_refund_rate, driver_fault_refund_rate, active) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 9, 1, 1, 1, 1, 1, false)$q$);
SELECT pg_temp.expect_denied('policy: UPDATE direct', $q$update public.cancellation_policies set partial_refund_rate = 1$q$);
SELECT pg_temp.expect_denied('policy: DELETE direct', $q$delete from public.cancellation_policies$q$);
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT pg_temp.expect_denied('policy: anon', $q$select count(*) from public.cancellation_policies$q$);
RESET ROLE;

SELECT pg_temp.expect_count('policy: v2 active, v1 inactive',
  $q$select count(*) from public.cancellation_policies where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     and ((version = 2 and active and hours_before_full_refund = 48 and partial_refund_rate = 0.3) or (version = 1 and not active))$q$, 2);
SELECT pg_temp.expect_count('policy: b1 garde la v1',
  $q$select count(*) from public.bookings b join public.cancellation_policies p on p.id = b.cancellation_policy_id
     where b.id = 'b1000000-0000-4000-8000-000000000001' and p.version = 1$q$, 1);
INSERT INTO public.bookings (id, original_tenant_id, current_tenant_id, customer_id, vehicle_id, driver_id, status,
  payment_mode, pickup_time, mission_status, pickup_address, dropoff_address, total_amount, subtotal_amount,
  vat_amount, booking_type, booking_source, pricing_mode) VALUES
  ('b9000000-0000-4000-8000-000000000009', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1000000-0000-4000-8000-00000000000a', 'ee000000-0000-4000-8000-00000000000a', NULL, 'pending', 'card', now() + interval '3 days', 'to_validate', 'A', 'B', 100, 90.91, 9.09, 'transfer', 'manual_driver', 'direct');
SELECT pg_temp.expect_count('policy: nouvelle course -> v2',
  $q$select count(*) from public.bookings b join public.cancellation_policies p on p.id = b.cancellation_policy_id
     where b.id = 'b9000000-0000-4000-8000-000000000009' and p.version = 2$q$, 1);

DO $$ BEGIN RAISE NOTICE 'RPC cancel checks passed.'; END $$;

ROLLBACK;
