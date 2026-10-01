-- Notation publique (Phase 14, D-09) : get_rating_context, submit_rating, appelées par anon.
-- Exécuté en CI sur une base reconstruite, transaction annulée.

\set ON_ERROR_STOP on
\o /dev/null

BEGIN;

\ir _rpc_fixtures.sql

CREATE FUNCTION pg_temp.expect_error(label text, stmt text, code text, msg text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = code AND SQLERRM = msg THEN RETURN; END IF;
    RAISE EXCEPTION 'FAIL [%] : % / "%" attendu, % / "%" obtenu', label, code, msg, SQLSTATE, SQLERRM;
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

-- Fixtures locales : logo + avis Google du tenant A, seconde course terminée b8bis.
UPDATE public.tenants SET logo_url = 'https://logo.invalid/a.png', google_reviews_url = 'https://g.invalid/r'
 WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
INSERT INTO public.bookings (id, original_tenant_id, current_tenant_id, customer_id, vehicle_id, driver_id, status,
  payment_mode, pickup_time, mission_status, pickup_address, dropoff_address, total_amount, subtotal_amount,
  vat_amount, booking_type, booking_source, pricing_mode)
SELECT 'b8000000-0000-4000-8000-0000000000b8', original_tenant_id, current_tenant_id, customer_id, vehicle_id, driver_id,
  status, payment_mode, pickup_time, mission_status, pickup_address, dropoff_address, total_amount, subtotal_amount,
  vat_amount, booking_type, booking_source, pricing_mode
FROM public.bookings WHERE id = 'b8000000-0000-4000-8000-000000000008';

-- Signature : 4 champs, rien d'autre.
SELECT pg_temp.expect_val('signature get_rating_context',
  $q$select pg_get_function_result('public.get_rating_context(uuid)'::regprocedure)$q$,
  'TABLE(tenant_name text, logo_url text, google_reviews_url text, already_rated boolean)');

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);

SELECT pg_temp.expect_val('ctx: nom', $q$select tenant_name from public.get_rating_context('b8000000-0000-4000-8000-000000000008')$q$, 'RPC Test A');
SELECT pg_temp.expect_val('ctx: logo', $q$select logo_url from public.get_rating_context('b8000000-0000-4000-8000-000000000008')$q$, 'https://logo.invalid/a.png');
SELECT pg_temp.expect_val('ctx: google', $q$select google_reviews_url from public.get_rating_context('b8000000-0000-4000-8000-000000000008')$q$, 'https://g.invalid/r');
SELECT pg_temp.expect_val('ctx: pas noté', $q$select already_rated::text from public.get_rating_context('b8000000-0000-4000-8000-000000000008')$q$, 'false');
SELECT pg_temp.expect_val('ctx: inconnu', $q$select count(*)::text from public.get_rating_context('99999999-9999-4999-8999-999999999999')$q$, '0');

SELECT pg_temp.expect_error('non terminée', $q$select public.submit_rating('b1000000-0000-4000-8000-000000000001', 5, NULL)$q$, '22023', 'Course non terminée');
SELECT pg_temp.expect_error('note 0', $q$select public.submit_rating('b8000000-0000-4000-8000-000000000008', 0, NULL)$q$, '22023', 'Note invalide (1-5)');
SELECT pg_temp.expect_error('note 6', $q$select public.submit_rating('b8000000-0000-4000-8000-000000000008', 6, NULL)$q$, '22023', 'Note invalide (1-5)');
SELECT pg_temp.expect_error('inconnue', $q$select public.submit_rating('99999999-9999-4999-8999-999999999999', 4, NULL)$q$, 'P0002', 'Réservation non trouvée');

SELECT public.submit_rating('b8000000-0000-4000-8000-000000000008', 4, repeat('x', 600));
SELECT pg_temp.expect_error('rejeu', $q$select public.submit_rating('b8000000-0000-4000-8000-000000000008', 5, NULL)$q$, '22023', 'Déjà noté');
SELECT pg_temp.expect_val('ctx: déjà noté', $q$select already_rated::text from public.get_rating_context('b8000000-0000-4000-8000-000000000008')$q$, 'true');

RESET ROLE;
SELECT pg_temp.expect_val('note', $q$select rating::text from public.bookings where id = 'b8000000-0000-4000-8000-000000000008'$q$, '4');
SELECT pg_temp.expect_val('commentaire 500', $q$select length(rating_comment)::text from public.bookings where id = 'b8000000-0000-4000-8000-000000000008'$q$, '500');
SELECT pg_temp.expect_val('date', $q$select (rating_created_at is not null)::text from public.bookings where id = 'b8000000-0000-4000-8000-000000000008'$q$, 'true');
SELECT pg_temp.expect_val('colonnes intactes', $q$select total_amount::text || status::text || mission_status::text from public.bookings where id = 'b8000000-0000-4000-8000-000000000008'$q$, '100.00completedcompleted');

-- authenticated (lien ouvert depuis un navigateur connecté)
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_ok('authenticated', $q$select public.submit_rating('b8000000-0000-4000-8000-0000000000b8', 5, 'ok')$q$);
RESET ROLE;
SELECT pg_temp.expect_val('note b8bis', $q$select rating::text from public.bookings where id = 'b8000000-0000-4000-8000-0000000000b8'$q$, '5');

DO $$ BEGIN RAISE NOTICE 'RPC rating checks passed.'; END $$;

ROLLBACK;
