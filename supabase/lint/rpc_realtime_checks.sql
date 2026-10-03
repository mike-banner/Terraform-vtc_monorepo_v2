-- Temps réel (phase 15, ADR-014) : updated_at, diffusion minimale, policy de réception, chemins d'écriture couverts.
-- Transaction annulée.

\set ON_ERROR_STOP on
\o /dev/null

-- Précondition : le service Realtime crée les partitions de realtime.messages ; sans partition du jour,
-- realtime.send échoue en silence.
DO $$
BEGIN
  FOR i IN 1..30 LOOP
    IF EXISTS (SELECT 1 FROM pg_inherits h JOIN pg_class c ON c.oid = h.inhrelid
               WHERE h.inhparent = 'realtime.messages'::regclass
                 AND c.relname = 'messages_' || to_char(now() AT TIME ZONE 'UTC', 'YYYY_MM_DD')) THEN
      RETURN;
    END IF;
    PERFORM pg_sleep(1);
  END LOOP;
  RAISE EXCEPTION 'FAIL [précondition] : aucune partition realtime.messages pour aujourd''hui (le service Realtime doit tourner)';
END $$;

BEGIN;

\ir _rpc_fixtures.sql

-- Messages booking_changed d'une course, sur le topic de son tenant.
CREATE FUNCTION pg_temp.msg_count(p_id uuid) RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM realtime.messages m JOIN public.bookings b ON b.id = p_id
  WHERE m.event = 'booking_changed' AND m.extension = 'broadcast' AND m.private
    AND m.topic = 'tenant:' || b.current_tenant_id::text || ':bookings'
    AND m.payload->>'id' = p_id::text
$$;
-- 1 si le dernier message (updated_at le plus récent) reflète l'état courant de la course.
CREATE FUNCTION pg_temp.last_msg_ok(p_id uuid) RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM (
    SELECT m.payload FROM realtime.messages m
    WHERE m.event = 'booking_changed' AND m.payload->>'id' = p_id::text
    ORDER BY (m.payload->>'updated_at')::timestamptz DESC LIMIT 1) l
  JOIN public.bookings b ON b.id = p_id
  WHERE l.payload->>'status' = b.status::text
    AND l.payload->>'mission_status' = b.mission_status::text
    AND (l.payload->>'driver_id') IS NOT DISTINCT FROM b.driver_id::text
    AND (l.payload->>'updated_at')::timestamptz = b.updated_at
$$;
-- Lignes de realtime.messages visibles pour la session courante, topic joint = p_topic (realtime.send repose ce réglage : toujours le reposer).
CREATE FUNCTION pg_temp.visible(p_topic text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  PERFORM set_config('realtime.topic', p_topic, true);
  SELECT count(*) INTO n FROM realtime.messages WHERE extension = 'broadcast';
  RETURN n;
END $$;
-- Échec si msg_count(p_id) n'a pas dépassé p_before.
CREATE FUNCTION pg_temp.expect_more(label text, p_id uuid, p_before bigint) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF pg_temp.msg_count(p_id) <= p_before THEN
    RAISE EXCEPTION 'FAIL [%] : aucun message booking_changed ajouté pour %', label, p_id;
  END IF;
  IF pg_temp.last_msg_ok(p_id) <> 1 THEN
    RAISE EXCEPTION 'FAIL [%] : le dernier message de % ne reflète pas l''état de la course', label, p_id;
  END IF;
END $$;
-- Id de la dernière course d'un client (par e-mail).
CREATE FUNCTION pg_temp.bid(p_email text) RETURNS uuid LANGUAGE sql AS $$
  SELECT b.id FROM public.bookings b JOIN public.customers c ON c.id = b.customer_id WHERE c.email = lower(p_email)
  ORDER BY b.created_at DESC LIMIT 1 $$;

-- ===== Schéma ===================================================================================
SELECT pg_temp.expect_count('schéma: updated_at',
  $q$select count(*) from information_schema.columns where table_schema='public' and table_name='bookings' and column_name='updated_at' and is_nullable='NO' and data_type='timestamp with time zone'$q$, 1);
SELECT pg_temp.expect_count('schéma: diffuseur DEFINER à search_path figé',
  $q$select count(*) from pg_proc where oid = 'public.broadcast_booking_change()'::regprocedure and prosecdef and exists (select 1 from unnest(proconfig) c where c like 'search\_path=%')$q$, 1);
SELECT pg_temp.expect_count('schéma: fonctions fermées aux clients',
  $q$select count(*) from (values ('anon'),('authenticated')) r(n) where has_function_privilege(r.n, 'public.broadcast_booking_change()', 'EXECUTE') or has_function_privilege(r.n, 'public.set_updated_at()', 'EXECUTE')$q$, 0);

-- ===== R1 : updated_at ==========================================================================
SELECT updated_at AS t0 FROM public.bookings WHERE id = 'b3000000-0000-4000-8000-000000000003' \gset
SELECT count(*) AS fm0 FROM public.financial_movements \gset
SELECT pg_temp.msg_count('b3000000-0000-4000-8000-000000000003') AS m0 \gset

UPDATE public.bookings SET mission_note = 'rt-1' WHERE id = 'b3000000-0000-4000-8000-000000000003';
SELECT updated_at AS t1 FROM public.bookings WHERE id = 'b3000000-0000-4000-8000-000000000003' \gset
SELECT pg_temp.expect_count('r1: avance (1)',
  format($q$select count(*) from public.bookings where id = 'b3000000-0000-4000-8000-000000000003' and updated_at > %L::timestamptz$q$, :'t0'), 1);

UPDATE public.bookings SET mission_note = 'rt-2' WHERE id = 'b3000000-0000-4000-8000-000000000003';
SELECT updated_at AS t2 FROM public.bookings WHERE id = 'b3000000-0000-4000-8000-000000000003' \gset
SELECT pg_temp.expect_count('r1: avance (2)',
  format($q$select count(*) from public.bookings where id = 'b3000000-0000-4000-8000-000000000003' and updated_at > %L::timestamptz$q$, :'t1'), 1);

UPDATE public.bookings SET mission_note = mission_note WHERE id = 'b3000000-0000-4000-8000-000000000003';
SELECT pg_temp.expect_count('r1: no-op',
  format($q$select count(*) from public.bookings where id = 'b3000000-0000-4000-8000-000000000003' and updated_at = %L::timestamptz$q$, :'t2'), 1);
SELECT pg_temp.expect_count('r1: no-op sans message',
  $q$select pg_temp.msg_count('b3000000-0000-4000-8000-000000000003')$q$, :m0 + 2);
SELECT pg_temp.expect_count('r1: aucun mouvement', 'select count(*) from public.financial_movements', :fm0);

-- ===== R2 : contenu des messages ================================================================
SELECT pg_temp.expect_count('r2: fixtures diffusées',
  $q$select pg_temp.msg_count('b1000000-0000-4000-8000-000000000001')$q$, 1);
SELECT pg_temp.expect_count('r2: 5 clés exactement',
  $q$select count(*) from realtime.messages where event = 'booking_changed' and (select array_agg(k order by k) from jsonb_object_keys(payload) k) <> array['driver_id','id','mission_status','status','updated_at']$q$, 0);
SELECT pg_temp.expect_count('r2: privé et broadcast',
  $q$select count(*) from realtime.messages where event = 'booking_changed' and (not private or extension <> 'broadcast')$q$, 0);

-- ===== R3 : réception ===========================================================================
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_count('r3: owner A reçoit A', $q$select count(*) from (select pg_temp.visible('tenant:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:bookings') v) s where v > 0$q$, 1);
SELECT pg_temp.login('22222222-2222-4222-8222-222222222222');
SELECT pg_temp.expect_count('r3: manager A reçoit A', $q$select count(*) from (select pg_temp.visible('tenant:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:bookings') v) s where v > 0$q$, 1);
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_count('r3: driver1 A reçoit A', $q$select count(*) from (select pg_temp.visible('tenant:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:bookings') v) s where v > 0$q$, 1);
SELECT pg_temp.login('55555555-5555-4555-8555-555555555555');
SELECT pg_temp.expect_count('r3: owner B ne reçoit pas A', $q$select pg_temp.visible('tenant:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:bookings')$q$, 0);
SELECT pg_temp.expect_count('r3: owner B reçoit B', $q$select count(*) from (select pg_temp.visible('tenant:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:bookings') v) s where v > 0$q$, 1);
SELECT pg_temp.login('66666666-6666-4666-8666-666666666666');
SELECT pg_temp.expect_count('r3: pending ne reçoit pas', $q$select pg_temp.visible('tenant:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:bookings')$q$, 0);
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_count('r3: owner A ne reçoit pas B', $q$select pg_temp.visible('tenant:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:bookings')$q$, 0);
SELECT pg_temp.expect_count('r3: owner A, topic voisin', $q$select pg_temp.visible('tenant:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:autre')$q$, 0);
SELECT pg_temp.expect_denied('r3: émission client', $q$insert into realtime.messages (topic, extension, event, payload, private) values ('tenant:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:bookings', 'broadcast', 'booking_changed', '{}'::jsonb, true)$q$);
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT pg_temp.expect_count('r3: anon ne reçoit pas', $q$select pg_temp.visible('tenant:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:bookings')$q$, 0);
RESET ROLE;

-- ===== DELETE : refusé, donc aucun trigger DELETE nécessaire ====================================
-- Un client n'a aucune policy DELETE : 0 ligne touchée, le trigger de garde ne tire même pas.
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
DELETE FROM public.bookings WHERE id = 'b3000000-0000-4000-8000-000000000003';
RESET ROLE;
SELECT pg_temp.expect_count('delete: client sans effet', $q$select count(*) from public.bookings where id = 'b3000000-0000-4000-8000-000000000003'$q$, 1);
-- Même postgres : trg_prevent_booking_delete. Si ce garde-fou saute, ce test échoue : il faudra un trigger AFTER DELETE.
SELECT pg_temp.expect_sqlstate('delete: refusé même postgres', $q$delete from public.bookings where id = 'b3000000-0000-4000-8000-000000000003'$q$, 'P0001');

-- ===== R7 : chaque chemin d'écriture diffuse ====================================================
-- Course payée Stripe à +48 h (annulation et remboursement raté).
INSERT INTO public.bookings (id, original_tenant_id, current_tenant_id, customer_id, vehicle_id, driver_id, status,
  payment_mode, stripe_payment_intent_id, pickup_time, mission_status, pickup_address, dropoff_address, total_amount,
  subtotal_amount, vat_amount, booking_type, booking_source, pricing_mode) VALUES
  ('e7000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'c1000000-0000-4000-8000-00000000000a', 'ee000000-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-000000000001',
   'paid', 'stripe', 'pi_rt_cancel', now() + interval '48 hours', 'not_started', 'A', 'B', 100, 90.91, 9.09,
   'transfer', 'manual_driver', 'direct');

-- INSERT par service_role
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
INSERT INTO public.bookings (id, original_tenant_id, current_tenant_id, customer_id, vehicle_id, driver_id, status,
  payment_mode, stripe_payment_intent_id, pickup_time, mission_status, pickup_address, dropoff_address, total_amount,
  subtotal_amount, vat_amount, booking_type, booking_source, pricing_mode) VALUES
  ('e7000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'c1000000-0000-4000-8000-00000000000a', 'ee000000-0000-4000-8000-00000000000a', NULL,
   'paid', 'stripe', 'pi_rt_ins', now() + interval '3 days', 'to_validate', 'A', 'B', 100, 90.91, 9.09,
   'transfer', 'customer', 'direct');
RESET ROLE;
SELECT pg_temp.expect_more('r7: insert service_role', 'e7000000-0000-4000-8000-000000000001', 0);

-- accept_paid_booking
SELECT pg_temp.msg_count('e7000000-0000-4000-8000-000000000001') AS n \gset
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_ok('r7: accept', $q$select public.accept_paid_booking('e7000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001')$q$);
RESET ROLE;
SELECT pg_temp.expect_more('r7: accept_paid_booking', 'e7000000-0000-4000-8000-000000000001', :n);

-- assignation de chauffeur par un client (écriture sous RLS : le trigger DEFINER diffuse)
SELECT pg_temp.msg_count('b2000000-0000-4000-8000-000000000002') AS n \gset
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_ok('r7: assign', $q$update public.bookings set driver_id = 'd1000000-0000-4000-8000-000000000001' where id = 'b2000000-0000-4000-8000-000000000002'$q$);
RESET ROLE;
SELECT pg_temp.expect_count('assign: appliquée', $q$select count(*) from public.bookings where id = 'b2000000-0000-4000-8000-000000000002' and driver_id = 'd1000000-0000-4000-8000-000000000001'$q$, 1);
SELECT pg_temp.expect_more('r7: assignation client', 'b2000000-0000-4000-8000-000000000002', :n);

-- terrain_transition
SELECT pg_temp.msg_count('b5000000-0000-4000-8000-000000000005') AS n \gset
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_ok('r7: terrain', $q$select public.terrain_transition('b5000000-0000-4000-8000-000000000005', 'en_route')$q$);
RESET ROLE;
SELECT pg_temp.expect_more('r7: terrain_transition', 'b5000000-0000-4000-8000-000000000005', :n);

-- cancel_booking
SELECT pg_temp.msg_count('e7000000-0000-4000-8000-000000000002') AS n \gset
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_ok('r7: cancel', $q$select public.cancel_booking('e7000000-0000-4000-8000-000000000002', 'client', null, 'rt')$q$);
RESET ROLE;
SELECT pg_temp.expect_more('r7: cancel_booking', 'e7000000-0000-4000-8000-000000000002', :n);

-- mark_refund_failed
SELECT pg_temp.msg_count('e7000000-0000-4000-8000-000000000002') AS n \gset
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT pg_temp.expect_ok('r7: refund_failed', $q$select public.mark_refund_failed('e7000000-0000-4000-8000-000000000002', 'rt')$q$);
RESET ROLE;
SELECT pg_temp.expect_count('refund_failed: statut', $q$select count(*) from public.bookings where id = 'e7000000-0000-4000-8000-000000000002' and status = 'refund_failed'$q$, 1);
SELECT pg_temp.expect_more('r7: mark_refund_failed', 'e7000000-0000-4000-8000-000000000002', :n);

-- Demandes et devis (14.1) : submit_booking_request (anon), prix fixé, devis accepté, demande refusée.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT pg_temp.expect_ok('r7: demande 1', $q$select public.submit_booking_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'longue_distance', 'Gare', '', now() + interval '3 days', null, 2, 1, 'ee000000-0000-4000-8000-00000000000a', 'Ana', 'B', 'rt-req1@x.invalid', '0600000000', 'rt')$q$);
SELECT pg_temp.expect_ok('r7: demande 2', $q$select public.submit_booking_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'longue_distance', 'Gare', '', now() + interval '4 days', null, 2, 1, 'ee000000-0000-4000-8000-00000000000a', 'Ana', 'B', 'rt-req2@x.invalid', '0600000000', 'rt')$q$);
RESET ROLE;
SELECT pg_temp.bid('rt-req1@x.invalid') AS rq1 \gset
SELECT pg_temp.bid('rt-req2@x.invalid') AS rq2 \gset
SELECT pg_temp.expect_more('r7: submit_booking_request', :'rq1', 0);

SELECT pg_temp.msg_count(:'rq1') AS n \gset
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_ok('r7: prix fixé', format($q$select public.update_booking_details(%L, now() + interval '3 days', 'Gare', NULL, NULL, NULL, 180)$q$, :'rq1'));
RESET ROLE;
SELECT pg_temp.expect_more('r7: fixation du prix', :'rq1', :n);

-- authorize_quote (envoi du devis) est un contrôle sans écriture : rien à diffuser.
SELECT pg_temp.msg_count(:'rq1') AS n \gset
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_ok('r7: accept devis', format($q$select public.accept_quote_manually(%L, true)$q$, :'rq1'));
RESET ROLE;
SELECT pg_temp.expect_more('r7: devis accepté', :'rq1', :n);

SELECT pg_temp.msg_count(:'rq2') AS n \gset
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('22222222-2222-4222-8222-222222222222');
SELECT pg_temp.expect_ok('r7: refus', format($q$select public.decline_booking_request(%L, 'rt')$q$, :'rq2'));
RESET ROLE;
SELECT pg_temp.expect_more('r7: demande refusée', :'rq2', :n);

DO $$ BEGIN RAISE NOTICE 'RPC realtime checks passed.'; END $$;
ROLLBACK;
