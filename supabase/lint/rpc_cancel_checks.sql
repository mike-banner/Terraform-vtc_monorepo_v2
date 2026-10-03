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

-- ===== Aperçu, annulation, remboursement (politique v1 : 24 h / 2 h / 50 %) ======================
INSERT INTO public.bookings (id, original_tenant_id, current_tenant_id, customer_id, vehicle_id, driver_id, status,
  payment_mode, stripe_payment_intent_id, pickup_time, mission_status, pickup_address, dropoff_address, total_amount,
  subtotal_amount, vat_amount, booking_type, booking_source, pricing_mode)
SELECT v.id::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'c1000000-0000-4000-8000-00000000000a', 'ee000000-0000-4000-8000-00000000000a',
  'd1000000-0000-4000-8000-000000000001', 'paid', 'stripe', v.pi, now() + v.delta, 'not_started', 'A', 'B',
  100, 90.91, 9.09, 'transfer', 'manual_driver', 'direct'
FROM (VALUES
  ('c4800000-0000-4000-8000-000000000048', 'pi_test_c48',   interval '48 hours'),
  ('c1000000-0000-4000-8000-000000000010', 'pi_test_c10',   interval '10 hours'),
  ('c0100000-0000-4000-8000-000000000001', 'pi_test_c1',    interval '1 hour'),
  ('c0000000-0000-4000-8000-0000000000aa', 'pi_test_cpast', interval '-1 hour')
) AS v(id, pi, delta);
UPDATE public.bookings SET stripe_payment_intent_id = 'pi_test_b4' WHERE id = 'b4000000-0000-4000-8000-000000000004';

SELECT count(*) AS mvts_avant FROM public.financial_movements \gset

SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_count('preview: owner c48 = 4 lignes', $q$select count(*) from public.cancellation_preview('c4800000-0000-4000-8000-000000000048')$q$, 4);
SELECT pg_temp.expect_count('preview: c48 client 100%',
  $q$select count(*) from public.cancellation_preview('c4800000-0000-4000-8000-000000000048') where case_code='client' and rate=1 and amount=100.00 and paid$q$, 1);
SELECT pg_temp.expect_count('preview: c48 no_show 0',
  $q$select count(*) from public.cancellation_preview('c4800000-0000-4000-8000-000000000048') where case_code='no_show' and rate=0 and amount=0.00$q$, 1);
SELECT pg_temp.expect_count('preview: c48 driver_fault 100%',
  $q$select count(*) from public.cancellation_preview('c4800000-0000-4000-8000-000000000048') where case_code='driver_fault' and rate=1 and amount=100.00$q$, 1);
SELECT pg_temp.expect_count('preview: other sans taux = NULL',
  $q$select count(*) from public.cancellation_preview('c4800000-0000-4000-8000-000000000048') where case_code='other' and rate is null and amount is null$q$, 1);
SELECT pg_temp.expect_count('preview: p_rate 0.25',
  $q$select count(*) from public.cancellation_preview('c4800000-0000-4000-8000-000000000048', 0.25) where case_code in ('other','no_show') and rate=0.25 and amount=25.00$q$, 2);
SELECT pg_temp.expect_count('preview: c10 client 50%',
  $q$select count(*) from public.cancellation_preview('c1000000-0000-4000-8000-000000000010') where case_code='client' and rate=0.5 and amount=50.00$q$, 1);
SELECT pg_temp.expect_count('preview: c1 client 0',
  $q$select count(*) from public.cancellation_preview('c0100000-0000-4000-8000-000000000001') where case_code='client' and rate=0$q$, 1);
SELECT pg_temp.expect_count('preview: cpast client 0',
  $q$select count(*) from public.cancellation_preview('c0000000-0000-4000-8000-0000000000aa') where case_code='client' and rate=0$q$, 1);
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_count('preview: driver1 = 2 lignes', $q$select count(*) from public.cancellation_preview('c4800000-0000-4000-8000-000000000048')$q$, 2);
SELECT pg_temp.login('44444444-4444-4444-8444-444444444444');
SELECT pg_temp.expect_denied('preview: driver2', $q$select * from public.cancellation_preview('c4800000-0000-4000-8000-000000000048')$q$);
SELECT pg_temp.expect_denied('cancel: driver2', $q$select public.cancel_booking('c4800000-0000-4000-8000-000000000048', 'client', null, 'x')$q$);
SELECT pg_temp.login('55555555-5555-4555-8555-555555555555');
SELECT pg_temp.expect_sqlstate('preview: owner B', $q$select * from public.cancellation_preview('c4800000-0000-4000-8000-000000000048')$q$, 'P0002');

-- Gardes de cancel_booking
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_error('cancel: note vide', $q$select public.cancel_booking('c4800000-0000-4000-8000-000000000048', 'client', null, '  ')$q$, '22023', 'Note obligatoire');
SELECT pg_temp.expect_sqlstate('cancel: cas inconnu', $q$select public.cancel_booking('c4800000-0000-4000-8000-000000000048', 'foo', null, 'x')$q$, '22023');
SELECT pg_temp.expect_sqlstate('cancel: other sans taux', $q$select public.cancel_booking('c4800000-0000-4000-8000-000000000048', 'other', null, 'x')$q$, '22023');
SELECT pg_temp.expect_sqlstate('cancel: taux 1.5', $q$select public.cancel_booking('c4800000-0000-4000-8000-000000000048', 'no_show', 1.5, 'x')$q$, '22023');
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_error('cancel: driver après l''heure', $q$select public.cancel_booking('c0000000-0000-4000-8000-0000000000aa', 'client', null, 'x')$q$, '22023', 'Annulation après l''heure : réservée au propriétaire ou au gestionnaire');
SELECT pg_temp.expect_error('cancel: driver no_show', $q$select public.cancel_booking('c4800000-0000-4000-8000-000000000048', 'no_show', null, 'x')$q$, '22023', 'Cas réservé au propriétaire ou au gestionnaire');
SELECT pg_temp.expect_error('driver_cancel: course payée', $q$select public.driver_cancel_booking('b4000000-0000-4000-8000-000000000004', 'Panne')$q$, '22023', 'Course payée : utiliser Annuler avec remboursement');
SELECT pg_temp.expect_ok('cancel: driver1 faute chauffeur c10', $q$select public.cancel_booking('c1000000-0000-4000-8000-000000000010', 'driver_fault', null, 'Panne')$q$);
RESET ROLE;
SELECT pg_temp.expect_count('cancel: c10 100% par driver',
  $q$select count(*) from public.bookings where id='c1000000-0000-4000-8000-000000000010' and status='cancelled_pending_refund'
     and refund_amount=100.00 and cancellation_initiator='driver' and cancellation_reason='driver_fault'$q$, 1);

-- Annulations owner / manager
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_ok('cancel: owner c48', $q$select public.cancel_booking('c4800000-0000-4000-8000-000000000048', 'client', null, 'Client a changé de plan')$q$);
SELECT pg_temp.expect_count('cancel: c48 rejeu identique',
  $q$select count(*) from (select public.cancel_booking('c4800000-0000-4000-8000-000000000048', 'client', null, 'autre') as r) s
     where r = '{"status":"cancelled_pending_refund","refund_amount":100.00,"payment_intent_id":"pi_test_c48","attempt":0}'::jsonb$q$, 1);
SELECT pg_temp.login('22222222-2222-4222-8222-222222222222');
SELECT pg_temp.expect_ok('cancel: manager cpast', $q$select public.cancel_booking('c0000000-0000-4000-8000-0000000000aa', 'no_show', 0.2, 'Client absent')$q$);
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_ok('cancel: owner c1 (0 %)', $q$select public.cancel_booking('c0100000-0000-4000-8000-000000000001', 'client', null, 'Trop tard')$q$);
SELECT pg_temp.expect_ok('cancel: owner b1 cash', $q$select public.cancel_booking('b1000000-0000-4000-8000-000000000001', 'client', null, 'Annulé par téléphone')$q$);
RESET ROLE;
SELECT pg_temp.expect_count('cancel: c48 état',
  $q$select count(*) from public.bookings where id='c4800000-0000-4000-8000-000000000048' and status='cancelled_pending_refund'
     and refund_amount=100.00 and refund_rate=1 and cancellation_reason='client' and cancellation_initiator='owner'
     and cancellation_note='Client a changé de plan' and mission_note like '%[annulation] initiateur=owner | motif=%' and refund_attempts=0$q$, 1);
SELECT pg_temp.expect_count('cancel: cpast 20 €',
  $q$select count(*) from public.bookings where id='c0000000-0000-4000-8000-0000000000aa' and status='cancelled_pending_refund' and refund_amount=20.00$q$, 1);
SELECT pg_temp.expect_count('cancel: c1 sans remboursement',
  $q$select count(*) from public.bookings where id='c0100000-0000-4000-8000-000000000001' and status='cancelled_no_refund'$q$, 1);
SELECT pg_temp.expect_count('cancel: b1 cash sans remboursement',
  $q$select count(*) from public.bookings where id='b1000000-0000-4000-8000-000000000001' and status='cancelled_no_refund' and refund_amount is null$q$, 1);
SELECT pg_temp.expect_count('cancel: aucun mouvement ledger ajouté', 'select count(*) from public.financial_movements', :mvts_avant);

-- Écriture au grand livre
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_denied('refund: authenticated', $q$select public.record_booking_refund('c4800000-0000-4000-8000-000000000048', 're_1', 100)$q$);
SELECT pg_temp.expect_denied('refund_failed: authenticated', $q$select public.mark_refund_failed('c4800000-0000-4000-8000-000000000048', 'x')$q$);
SELECT pg_temp.expect_denied('ledger: authenticated', $q$select public.ledger_insert_refund('c4800000-0000-4000-8000-000000000048', 10, 're_x', 'x', 'pi')$q$);
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT pg_temp.expect_denied('ledger: service_role', $q$select public.ledger_insert_refund('c4800000-0000-4000-8000-000000000048', 10, 're_x', 'x', 'pi')$q$);
SELECT pg_temp.expect_ok('refund: c48', $q$select public.record_booking_refund('c4800000-0000-4000-8000-000000000048', 're_1', 100)$q$);
SELECT pg_temp.expect_ok('refund: c48 rejeu', $q$select public.record_booking_refund('c4800000-0000-4000-8000-000000000048', 're_1', 100)$q$);
SELECT pg_temp.expect_count('refund: failed sur c48 remboursée',
  $q$select count(*) from (select public.mark_refund_failed('c4800000-0000-4000-8000-000000000048', 'x') as s) t where s = 'cancelled_refunded'$q$, 1);
SELECT pg_temp.expect_ok('refund_failed: cpast', $q$select public.mark_refund_failed('c0000000-0000-4000-8000-0000000000aa', 'carte fermée')$q$);
RESET ROLE;
SELECT pg_temp.expect_count('refund: c48 un seul mouvement',
  $q$select count(*) from public.financial_movements where booking_id='c4800000-0000-4000-8000-000000000048' and movement_type='refund'
     and direction='debit' and gross_amount=100.00 and vat_amount=9.09 and net_amount=90.91 and refund_ratio=1
     and stripe_refund_id='re_1' and stripe_payment_intent_id='pi_test_c48'$q$, 1);
SELECT pg_temp.expect_count('refund: c48 remboursée',
  $q$select count(*) from public.bookings where id='c4800000-0000-4000-8000-000000000048' and status='cancelled_refunded'$q$, 1);
SELECT pg_temp.expect_count('refund_failed: cpast',
  $q$select count(*) from public.bookings where id='c0000000-0000-4000-8000-0000000000aa' and status='refund_failed' and mission_note like '%[remboursement] échec : carte fermée%'$q$, 1);
SELECT pg_temp.expect_error('ledger: dépasse les encaissements', $q$select public.ledger_insert_refund('c0100000-0000-4000-8000-000000000001', 150, 're_big', 'x', 'pi_test_c1')$q$, '22023', 'Remboursement supérieur aux encaissements');

-- retry_refund puis montant incohérent
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_denied('retry: driver', $q$select public.retry_refund('c0000000-0000-4000-8000-0000000000aa')$q$);
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_sqlstate('retry: c48 non en échec', $q$select public.retry_refund('c4800000-0000-4000-8000-000000000048')$q$, '22023');
SELECT pg_temp.expect_count('retry: cpast',
  $q$select count(*) from (select public.retry_refund('c0000000-0000-4000-8000-0000000000aa') as r) s
     where r->>'status' = 'cancelled_pending_refund' and (r->>'attempt')::int = 1$q$, 1);
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT pg_temp.expect_sqlstate('refund: montant incohérent', $q$select public.record_booking_refund('c0000000-0000-4000-8000-0000000000aa', 're_2', 99)$q$, '22023');
SELECT pg_temp.expect_ok('refund: cpast 20 €', $q$select public.record_booking_refund('c0000000-0000-4000-8000-0000000000aa', 're_2', 20)$q$);
RESET ROLE;
SELECT pg_temp.expect_count('refund: cpast partiel',
  $q$select count(*) from public.financial_movements where booking_id='c0000000-0000-4000-8000-0000000000aa' and movement_type='refund'
     and gross_amount=20.00 and vat_amount=1.82 and net_amount=18.18 and refund_ratio=0.2$q$, 1);
SELECT pg_temp.expect_count('privilèges: ledger_insert_refund fermée',
  $q$select count(*) from (values ('authenticated'),('service_role'),('anon')) r(n)
     where has_function_privilege(r.n, 'public.ledger_insert_refund(uuid,numeric,text,text,text)', 'EXECUTE')$q$, 0);
SELECT pg_temp.expect_count('privilèges: refund réservé à service_role',
  $q$select count(*) from (values ('authenticated'),('anon')) r(n)
     where has_function_privilege(r.n, 'public.record_booking_refund(uuid,text,numeric)', 'EXECUTE')
        or has_function_privilege(r.n, 'public.mark_refund_failed(uuid,text)', 'EXECUTE')
        or has_function_privilege(r.n, 'public.cancel_booking(uuid,text,numeric,text)', 'EXECUTE') and r.n = 'anon'$q$, 0);

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

-- ===== accept_paid_booking ======================================================================
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
INSERT INTO public.bookings (id, original_tenant_id, current_tenant_id, customer_id, vehicle_id, driver_id, status,
  payment_mode, stripe_payment_intent_id, pickup_time, mission_status, pickup_address, dropoff_address, total_amount,
  subtotal_amount, vat_amount, booking_type, booking_source, pricing_mode)
SELECT v.id::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'c1000000-0000-4000-8000-00000000000a', 'ee000000-0000-4000-8000-00000000000a', NULL, 'paid', 'stripe', v.pi,
  now() + interval '3 days', v.ms::public.mission_status_enum, 'A', 'B', 100, 90.91, 9.09, 'transfer', 'customer', 'direct'
FROM (VALUES
  ('a0000000-0000-4000-8000-0000000000a1', 'pi_test_ap1', 'to_validate'),
  ('a0000000-0000-4000-8000-0000000000a2', 'pi_test_ap2', 'to_validate'),
  ('a0000000-0000-4000-8000-0000000000a3', 'pi_test_ap3', 'in_progress')
) AS v(id, pi, ms);
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_ok('accept: owner prend a1 pour d1', $q$select public.accept_paid_booking('a0000000-0000-4000-8000-0000000000a1', 'd1000000-0000-4000-8000-000000000001')$q$);
SELECT pg_temp.expect_ok('accept: rejeu', $q$select public.accept_paid_booking('a0000000-0000-4000-8000-0000000000a1', 'd1000000-0000-4000-8000-000000000001')$q$);
SELECT pg_temp.expect_count('accept: a1 not_started, d1, statut paid',
  $q$select count(*) from public.bookings where id = 'a0000000-0000-4000-8000-0000000000a1' and status = 'paid'
     and mission_status = 'not_started' and driver_id = 'd1000000-0000-4000-8000-000000000001'$q$, 1);
SELECT pg_temp.expect_sqlstate('accept: course non payée', $q$select public.accept_paid_booking('b3000000-0000-4000-8000-000000000003', 'd1000000-0000-4000-8000-000000000001')$q$, '22023');
SELECT pg_temp.expect_sqlstate('accept: mission démarrée', $q$select public.accept_paid_booking('a0000000-0000-4000-8000-0000000000a3', 'd1000000-0000-4000-8000-000000000001')$q$, '22023');
SELECT pg_temp.expect_error('accept: chauffeur inconnu', $q$select public.accept_paid_booking('a0000000-0000-4000-8000-0000000000a2', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')$q$, '22023', 'Chauffeur inconnu');
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_sqlstate('accept: driver1 pour d2', $q$select public.accept_paid_booking('a0000000-0000-4000-8000-0000000000a2', 'd2000000-0000-4000-8000-000000000002')$q$, '42501');
SELECT pg_temp.expect_ok('accept: driver1 pour d1', $q$select public.accept_paid_booking('a0000000-0000-4000-8000-0000000000a2', 'd1000000-0000-4000-8000-000000000001')$q$);
SELECT pg_temp.login('55555555-5555-4555-8555-555555555555');
SELECT pg_temp.expect_sqlstate('accept: owner B', $q$select public.accept_paid_booking('a0000000-0000-4000-8000-0000000000a1', 'd1000000-0000-4000-8000-000000000001')$q$, 'P0002');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT pg_temp.expect_denied('accept: anon', $q$select public.accept_paid_booking('a0000000-0000-4000-8000-0000000000a1', 'd1000000-0000-4000-8000-000000000001')$q$);
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'RPC cancel checks passed.'; END $$;

ROLLBACK;
