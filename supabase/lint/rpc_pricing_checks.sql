-- Formule de prix et décomposition TVA (Phase 14, D-03) : vecteurs communs, base reconstruite, transaction annulée.

\set ON_ERROR_STOP on
\o /dev/null

BEGIN;

\ir _rpc_fixtures.sql

INSERT INTO public.vehicles (id, tenant_id, driver_id, category, brand, model, plate_number) VALUES
  ('ee000000-0000-4000-8000-00000000000b', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', NULL, 'van', 'Test', 'B', 'RPC-002-AA');
INSERT INTO public.pricing_rules (id, tenant_id, service_category, base_price, price_per_km, price_per_hour, minimum_fare, created_at) VALUES
  ('ff000000-0000-4000-8000-00000000000b', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'suv', 100, 1, 1, 0, now() + interval '1 second');
INSERT INTO public.pricing_rules (id, tenant_id, service_category, base_price, price_per_km, price_per_hour, minimum_fare, active) VALUES
  ('ff000000-0000-4000-8000-00000000000c', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'van', 999, 0, 0, 0, false);

CREATE FUNCTION pg_temp.expect_eq(label text, got numeric, want numeric)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN
    RAISE EXCEPTION 'FAIL [%] : % attendu, % obtenu', label, want, got;
  END IF;
END $$;

DO $$
DECLARE
  a constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  berline constant uuid := 'ee000000-0000-4000-8000-00000000000a';
  van constant uuid := 'ee000000-0000-4000-8000-00000000000b';
  r record;
BEGIN
  PERFORM pg_temp.expect_eq('transfert 30 km', public.calculate_booking_price(a, berline, 'transfer', 30, NULL), 70);
  PERFORM pg_temp.expect_eq('transfert minimum', public.calculate_booking_price(a, berline, 'transfer', 2, NULL), 20);
  PERFORM pg_temp.expect_eq('transfert sans km', public.calculate_booking_price(a, berline, 'transfer', NULL, NULL), 20);
  PERFORM pg_temp.expect_eq('hourly 2 h', public.calculate_booking_price(a, berline, 'hourly', NULL, 2), 110);
  PERFORM pg_temp.expect_eq('hourly 1 h par défaut', public.calculate_booking_price(a, berline, 'hourly', NULL, NULL), 60);
  -- van : règle van inactive ignorée, repli sur la règle active la plus récente (suv)
  PERFORM pg_temp.expect_eq('repli catégorie', public.calculate_booking_price(a, van, 'transfer', 10, NULL), 110);
  PERFORM pg_temp.expect_eq('tenant sans règle', public.calculate_booking_price('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', NULL, 'transfer', 10, NULL), NULL);

  SELECT * INTO r FROM public.booking_vat_split(100, 10, false);
  PERFORM pg_temp.expect_eq('tva 100 net', r.net, 90.91);
  PERFORM pg_temp.expect_eq('tva 100 vat', r.vat, 9.09);
  PERFORM pg_temp.expect_eq('tva 100 gross', r.gross, 100);
  SELECT * INTO r FROM public.booking_vat_split(50, 10, true);
  PERFORM pg_temp.expect_eq('exonéré net', r.net, 50);
  PERFORM pg_temp.expect_eq('exonéré vat', r.vat, 0);
  SELECT * INTO r FROM public.booking_vat_split(50, 10, NULL);
  PERFORM pg_temp.expect_eq('exonération NULL net', r.net, 50);
  PERFORM pg_temp.expect_eq('exonération NULL vat', r.vat, 0);
  SELECT * INTO r FROM public.booking_vat_split(50, 0, false);
  PERFORM pg_temp.expect_eq('taux nul net', r.net, 50);
  PERFORM pg_temp.expect_eq('taux nul vat', r.vat, 0);
  -- DECISION-ARRONDI V1 : TVA = brut - net arrondi, net + TVA = brut
  SELECT * INTO r FROM public.booking_vat_split(33.33, 20, false);
  PERFORM pg_temp.expect_eq('arrondi V1 net', r.net, 27.78);
  PERFORM pg_temp.expect_eq('arrondi V1 vat', r.vat, 5.55);
  PERFORM pg_temp.expect_eq('arrondi V1 somme', r.net + r.vat, 33.33);
END $$;

SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_denied('authenticated: prix', $q$select public.calculate_booking_price('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ee000000-0000-4000-8000-00000000000a','transfer',30,NULL)$q$);
SELECT pg_temp.expect_denied('authenticated: tva', $q$select * from public.booking_vat_split(100,10,false)$q$);
RESET ROLE;

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT pg_temp.expect_denied('anon: prix', $q$select public.calculate_booking_price('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ee000000-0000-4000-8000-00000000000a','transfer',30,NULL)$q$);
SELECT pg_temp.expect_denied('anon: tva', $q$select * from public.booking_vat_split(100,10,false)$q$);
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'RPC pricing checks passed.'; END $$;

ROLLBACK;
