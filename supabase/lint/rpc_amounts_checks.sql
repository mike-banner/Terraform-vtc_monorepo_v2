-- Phase 16 (D-02) : RPC de montants (quote_booking_estimate, tenant_ledger_year, tenant_ledger_month).
-- Base reconstruite, transaction annulée.

\set ON_ERROR_STOP on
\o /dev/null

BEGIN;

\ir _rpc_fixtures.sql

-- Données propres au test : véhicule et trajet fixe du tenant B, trajet fixe du tenant A.
INSERT INTO public.vehicles (id, tenant_id, category, brand, model, plate_number) VALUES
  ('ee000000-0000-4000-8000-0000000000bb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'berline', 'Test', 'B', 'RPC-BBB-BB');
INSERT INTO public.zones (id, tenant_id, name) VALUES
  ('2a000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Zone A1'),
  ('2a000000-0000-4000-8000-0000000000a2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Zone A2'),
  ('2b000000-0000-4000-8000-0000000000b1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Zone B1'),
  ('2b000000-0000-4000-8000-0000000000b2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Zone B2');
INSERT INTO public.fixed_routes (id, tenant_id, pickup_zone_id, dropoff_zone_id, vehicle_category, price) VALUES
  ('f1000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2a000000-0000-4000-8000-0000000000a1', '2a000000-0000-4000-8000-0000000000a2', 'berline', 55),
  ('f1000000-0000-4000-8000-0000000000b1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2b000000-0000-4000-8000-0000000000b1', '2b000000-0000-4000-8000-0000000000b2', 'berline', 999);

INSERT INTO public.bookings (id, original_tenant_id, current_tenant_id, customer_id, status, payment_mode, pickup_time,
  mission_status, pickup_address, dropoff_address, total_amount, subtotal_amount, vat_amount, booking_type, booking_source, pricing_mode) VALUES
  ('b9000000-0000-4000-8000-000000000091', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1000000-0000-4000-8000-00000000000a', 'pending', 'card', now() + interval '5 days', 'to_validate', 'A', 'B', 100, 90.91, 9.09, 'transfer', 'manual_driver', 'direct'),
  ('b9000000-0000-4000-8000-000000000092', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1000000-0000-4000-8000-00000000000a', 'pending', 'cash', now() + interval '5 days', 'to_validate', 'A', 'B', 100, 90.91, 9.09, 'transfer', 'manual_driver', 'direct');

-- Mouvements de 2020 (mois sans rien d'autre) : carte 100 payés puis 30 remboursés, espèces 50 ; tenant B 100.
INSERT INTO public.financial_movements (booking_id, tenant_id, movement_type, direction, gross_amount, net_amount, vat_amount, created_at) VALUES
  ('b9000000-0000-4000-8000-000000000091', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'payment', 'credit', 100, 90.91, 9.09, '2020-03-15 10:00+01'),
  ('b9000000-0000-4000-8000-000000000091', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'refund',  'debit',   30, 27.27, 2.73, '2020-03-16 10:00+01'),
  ('b9000000-0000-4000-8000-000000000092', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'payment', 'credit',  50, 45.45, 4.55, '2020-03-20 10:00+01'),
  ('bb000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'payment', 'credit', 100, 90.91, 9.09, '2020-03-15 10:00+01');

CREATE FUNCTION pg_temp.expect_eq(label text, got numeric, want numeric)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN
    RAISE EXCEPTION 'FAIL [%] : % attendu, % obtenu', label, want, got;
  END IF;
END $$;

-- owner du tenant A ----------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');

DO $$
DECLARE
  berline constant uuid := 'ee000000-0000-4000-8000-00000000000a';
  j jsonb; m jsonb; mv jsonb;
  s_gross numeric; s_net numeric;
BEGIN
  -- Aperçu = barème serveur (10 + 2 km, minimum 20, 50 par heure)
  PERFORM pg_temp.expect_eq('estimation transfert 30 km', public.quote_booking_estimate(berline, 'transfer', 30), 70);
  PERFORM pg_temp.expect_eq('estimation minimum', public.quote_booking_estimate(berline, 'transfer', 2), 20);
  PERFORM pg_temp.expect_eq('estimation sans km', public.quote_booking_estimate(berline, 'transfer'), 20);
  PERFORM pg_temp.expect_eq('estimation hourly 2 h', public.quote_booking_estimate(berline, 'hourly', NULL, 2), 110);
  PERFORM pg_temp.expect_eq('estimation hourly défaut', public.quote_booking_estimate(berline, 'hourly'), 60);
  PERFORM pg_temp.expect_eq('estimation forfait', public.quote_booking_estimate(berline, 'transfer', 30, NULL, 'f1000000-0000-4000-8000-0000000000a1'), 55);

  -- Année 2020 : 12 mois, totaux = somme des mois = vue
  j := public.tenant_ledger_year(2020);
  PERFORM pg_temp.expect_eq('année : 12 mois', jsonb_array_length(j->'months'), 12);
  PERFORM pg_temp.expect_eq('année : mois 3 brut', (j->'months'->2->>'gross')::numeric, 120);
  PERFORM pg_temp.expect_eq('année : mois 1 vide', (j->'months'->0->>'gross')::numeric, 0);
  PERFORM pg_temp.expect_eq('année : totaux brut', (j->'totals'->>'gross')::numeric, 120);
  SELECT sum(gross_revenue), sum(net_revenue) INTO s_gross, s_net FROM public.tenant_accounting_ledger WHERE year = 2020;
  PERFORM pg_temp.expect_eq('année : brut = vue', (j->'totals'->>'gross')::numeric, s_gross);
  PERFORM pg_temp.expect_eq('année : net = vue', (j->'totals'->>'net')::numeric, s_net);
  SELECT sum((x->>'gross')::numeric) INTO s_gross FROM jsonb_array_elements(j->'months') x;
  PERFORM pg_temp.expect_eq('année : totaux = somme des mois', (j->'totals'->>'gross')::numeric, s_gross);

  -- Mois : paiement 100 + remboursement 30 + espèces 50
  j := public.tenant_ledger_month(2020, 3);
  PERFORM pg_temp.expect_eq('mois : brut total', (j->'totals'->>'gross')::numeric, 120);
  PERFORM pg_temp.expect_eq('mois : lignes', jsonb_array_length(j->'movements'), 3);
  SELECT x INTO mv FROM jsonb_array_elements(j->'movements') x WHERE x->>'movement_type' = 'refund';
  PERFORM pg_temp.expect_eq('mois : remboursement signé brut', (mv->>'signed_gross')::numeric, -30);
  PERFORM pg_temp.expect_eq('mois : remboursement signé TVA', (mv->>'signed_vat')::numeric, -2.73);
  j := public.tenant_ledger_month(2020, 3, 'card');
  PERFORM pg_temp.expect_eq('mois carte : brut', (j->'totals'->>'gross')::numeric, 70);
  PERFORM pg_temp.expect_eq('mois carte : lignes', jsonb_array_length(j->'movements'), 2);
  j := public.tenant_ledger_month(2020, 3, 'cash');
  PERFORM pg_temp.expect_eq('mois espèces : brut', (j->'totals'->>'gross')::numeric, 50);
  PERFORM pg_temp.expect_eq('mois espèces : lignes', jsonb_array_length(j->'movements'), 1);
  j := public.tenant_ledger_month(2019, 3);
  PERFORM pg_temp.expect_eq('mois vide', jsonb_array_length(j->'movements'), 0);
END $$;

-- Tenant B : jamais visible
SELECT pg_temp.expect_sqlstate('owner A : véhicule de B', $q$select public.quote_booking_estimate('ee000000-0000-4000-8000-0000000000bb','transfer',30)$q$, 'P0002');
SELECT pg_temp.expect_sqlstate('owner A : trajet de B', $q$select public.quote_booking_estimate('ee000000-0000-4000-8000-00000000000a','transfer',30,NULL,'f1000000-0000-4000-8000-0000000000b1')$q$, 'P0002');
SELECT pg_temp.expect_sqlstate('mode invalide', $q$select public.tenant_ledger_month(2020,3,'bitcoin')$q$, '22023');
RESET ROLE;

-- owner du tenant B : ne voit pas le tenant A
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('55555555-5555-4555-8555-555555555555');
DO $$
DECLARE j jsonb;
BEGIN
  j := public.tenant_ledger_year(2020);
  IF (j->'totals'->>'gross')::numeric IS DISTINCT FROM 100 THEN
    RAISE EXCEPTION 'FAIL [owner B : année] : 100 attendu, % obtenu', j->'totals'->>'gross';
  END IF;
  j := public.tenant_ledger_month(2020, 3);
  IF jsonb_array_length(j->'movements') <> 1 THEN
    RAISE EXCEPTION 'FAIL [owner B : mois] : 1 ligne attendue, % obtenue', jsonb_array_length(j->'movements');
  END IF;
END $$;
RESET ROLE;

-- manager : autorisé ; driver : refusé
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('22222222-2222-4222-8222-222222222222');
SELECT pg_temp.expect_ok('manager : estimation', $q$select public.quote_booking_estimate('ee000000-0000-4000-8000-00000000000a','transfer',30)$q$);
SELECT pg_temp.expect_ok('manager : année', $q$select public.tenant_ledger_year(2020)$q$);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_sqlstate('driver : estimation', $q$select public.quote_booking_estimate('ee000000-0000-4000-8000-00000000000a','transfer',30)$q$, '42501');
SELECT pg_temp.expect_sqlstate('driver : année', $q$select public.tenant_ledger_year(2020)$q$, '42501');
SELECT pg_temp.expect_sqlstate('driver : mois', $q$select public.tenant_ledger_month(2020,3)$q$, '42501');
RESET ROLE;

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT pg_temp.expect_sqlstate('anon : estimation', $q$select public.quote_booking_estimate('ee000000-0000-4000-8000-00000000000a','transfer',30)$q$, '42501');
SELECT pg_temp.expect_sqlstate('anon : année', $q$select public.tenant_ledger_year(2020)$q$, '42501');
SELECT pg_temp.expect_sqlstate('anon : mois', $q$select public.tenant_ledger_month(2020,3)$q$, '42501');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'RPC amounts checks passed.'; END $$;

ROLLBACK;
