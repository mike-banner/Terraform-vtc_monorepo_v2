-- Fixtures communes des suites RPC de la Phase 14 (rpc_*_checks.sql).
-- Inclus par \ir APRÈS le BEGIN; de chaque suite : ce fichier n'ouvre ni ne ferme de transaction.

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

-- Instruction qui doit échouer avec exactement ce SQLSTATE (effet annulé).
CREATE FUNCTION pg_temp.expect_sqlstate(label text, stmt text, code text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = code THEN RETURN; END IF;
    RAISE EXCEPTION 'FAIL [%] : SQLSTATE % attendu, % obtenu (%)', label, code, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'FAIL [%] : SQLSTATE % attendu, instruction acceptée', label, code;
END $$;

-- Instruction qui doit réussir (effet conservé).
CREATE FUNCTION pg_temp.expect_ok(label text, stmt text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE stmt;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'FAIL [%] : % (%)', label, SQLERRM, SQLSTATE;
END $$;

-- Simule la session d'un utilisateur authentifié (à combiner avec SET LOCAL ROLE authenticated).
CREATE FUNCTION pg_temp.login(uid uuid)
RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Fixtures (postgres, BYPASSRLS) ---------------------------------------------
INSERT INTO public.tenants (id, name, primary_domain, legal_form, setup_completed) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'RPC Test A', 'rpc-test-a.invalid', 'sasu', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'RPC Test B', 'rpc-test-b.invalid', 'auto_entrepreneur', true);

-- handle_new_user crée le profil (tenant_role 'pending').
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-4111-8111-111111111111', 'owner-a@rpc.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'manager-a@rpc.invalid'),
  ('33333333-3333-4333-8333-333333333333', 'driver1-a@rpc.invalid'),
  ('44444444-4444-4444-8444-444444444444', 'driver2-a@rpc.invalid'),
  ('55555555-5555-4555-8555-555555555555', 'owner-b@rpc.invalid'),
  ('66666666-6666-4666-8666-666666666666', 'pending@rpc.invalid');

UPDATE public.profiles SET tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tenant_role = 'owner'
  WHERE id = '11111111-1111-4111-8111-111111111111';
UPDATE public.profiles SET tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tenant_role = 'manager'
  WHERE id = '22222222-2222-4222-8222-222222222222';
UPDATE public.profiles SET tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tenant_role = 'driver'
  WHERE id IN ('33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444');
UPDATE public.profiles SET tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tenant_role = 'owner'
  WHERE id = '55555555-5555-4555-8555-555555555555';

INSERT INTO public.drivers (id, tenant_id, user_id, first_name, last_name, phone, license_number) VALUES
  ('d0000000-0000-4000-8000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Zero', 'Chauffeur', '0600000000', 'RPC000000000'),
  ('d1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'Un', 'Chauffeur', '0600000001', 'RPC000000001'),
  ('d2000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '44444444-4444-4444-8444-444444444444', 'Deux', 'Chauffeur', '0600000002', 'RPC000000002');

INSERT INTO public.vehicles (id, tenant_id, driver_id, category, brand, model, plate_number) VALUES
  ('ee000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'd0000000-0000-4000-8000-000000000000', 'berline', 'Test', 'A', 'RPC-001-AA');

INSERT INTO public.pricing_rules (id, tenant_id, service_category, base_price, price_per_km, price_per_hour, minimum_fare) VALUES
  ('ff000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'berline', 10, 2, 50, 20);

INSERT INTO public.customers (id, tenant_id, email, first_name) VALUES
  ('c1000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'client-a@rpc.invalid', 'ClientA');

-- b1..b8 : tenant A ; bb : tenant B. Les INSERT paid/completed créent un mouvement ledger (postgres : attendu).
INSERT INTO public.bookings (id, original_tenant_id, current_tenant_id, customer_id, vehicle_id, driver_id, status,
  payment_mode, pickup_time, mission_status, pickup_address, dropoff_address, total_amount, subtotal_amount,
  vat_amount, booking_type, booking_source, pricing_mode) VALUES
  ('b1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1000000-0000-4000-8000-00000000000a', 'ee000000-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-000000000001', 'accepted', 'cash', now() + interval '3 days',   'not_started', 'A', 'B', 100, 90.91, 9.09, 'transfer', 'manual_driver', 'direct'),
  ('b2000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1000000-0000-4000-8000-00000000000a', 'ee000000-0000-4000-8000-00000000000a', 'd2000000-0000-4000-8000-000000000002', 'accepted', 'cash', now() + interval '3 days',   'not_started', 'A', 'B', 100, 90.91, 9.09, 'transfer', 'manual_driver', 'direct'),
  ('b3000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1000000-0000-4000-8000-00000000000a', 'ee000000-0000-4000-8000-00000000000a', NULL,                                    'pending',  'card', now() + interval '3 days',   'to_validate', 'A', 'B', 100, 90.91, 9.09, 'transfer', 'manual_driver', 'direct'),
  ('b4000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1000000-0000-4000-8000-00000000000a', 'ee000000-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-000000000001', 'paid',     'card', now() + interval '3 days',   'not_started', 'A', 'B', 100, 90.91, 9.09, 'transfer', 'manual_driver', 'direct'),
  ('b5000000-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1000000-0000-4000-8000-00000000000a', 'ee000000-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-000000000001', 'accepted', 'cash', now() + interval '10 minutes', 'not_started', 'A', 'B', 100, 90.91, 9.09, 'transfer', 'manual_driver', 'direct'),
  ('b6000000-0000-4000-8000-000000000006', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1000000-0000-4000-8000-00000000000a', 'ee000000-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-000000000001', 'paid',     'card', now() + interval '2 hours',  'not_started', 'A', 'B', 100, 90.91, 9.09, 'transfer', 'manual_driver', 'direct'),
  ('b7000000-0000-4000-8000-000000000007', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1000000-0000-4000-8000-00000000000a', 'ee000000-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-000000000001', 'accepted', 'cash', now() - interval '1 hour',   'not_started', 'A', 'B', 100, 90.91, 9.09, 'transfer', 'manual_driver', 'direct'),
  ('b8000000-0000-4000-8000-000000000008', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1000000-0000-4000-8000-00000000000a', 'ee000000-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-000000000001', 'completed','cash', now() - interval '1 day',    'completed',   'A', 'B', 100, 90.91, 9.09, 'transfer', 'manual_driver', 'direct');

-- Course du tenant B : client propre au tenant B.
INSERT INTO public.customers (id, tenant_id, email, first_name) VALUES
  ('c1000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'client-b@rpc.invalid', 'ClientB');
INSERT INTO public.bookings (id, original_tenant_id, current_tenant_id, customer_id, driver_id, status,
  payment_mode, pickup_time, mission_status, pickup_address, dropoff_address, total_amount, subtotal_amount,
  vat_amount, booking_type, booking_source, pricing_mode) VALUES
  ('bb000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'c1000000-0000-4000-8000-00000000000b', NULL, 'pending', 'card', now() + interval '3 days', 'to_validate', 'A', 'B', 100, 90.91, 9.09, 'transfer', 'manual_driver', 'direct');
