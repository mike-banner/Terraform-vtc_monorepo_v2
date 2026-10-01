-- RPC mark_booking_no_show : course non réalisée (client absent). Transaction annulée.
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

SELECT count(*) AS mvts_avant FROM public.financial_movements \gset

-- Accès : anon, chauffeur et manager exclus du chauffeur ; seul owner/manager passent.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT pg_temp.expect_denied('noshow: anon', $q$select public.mark_booking_no_show('b7000000-0000-4000-8000-000000000007', 'Client absent')$q$);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_denied('noshow: chauffeur propriétaire de la course', $q$select public.mark_booking_no_show('b7000000-0000-4000-8000-000000000007', 'Client absent')$q$);
SELECT pg_temp.login('55555555-5555-4555-8555-555555555555');
SELECT pg_temp.expect_sqlstate('noshow: owner tenant B sur b7', $q$select public.mark_booking_no_show('b7000000-0000-4000-8000-000000000007', 'Client absent')$q$, 'P0002');

SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_error('noshow: motif vide', $q$select public.mark_booking_no_show('b7000000-0000-4000-8000-000000000007', '  ')$q$, '22023', 'Motif requis');
SELECT pg_temp.expect_error('noshow: prise en charge future', $q$select public.mark_booking_no_show('b1000000-0000-4000-8000-000000000001', 'Client absent')$q$, '22023', 'Prise en charge pas encore passée : utiliser Annuler');
SELECT pg_temp.expect_error('noshow: course payée', $q$select public.mark_booking_no_show('b4000000-0000-4000-8000-000000000004', 'Client absent')$q$, '22023', 'Course non concernée : seule une course acceptée peut être marquée non réalisée');
SELECT pg_temp.expect_error('noshow: course terminée', $q$select public.mark_booking_no_show('b8000000-0000-4000-8000-000000000008', 'Client absent')$q$, '22023', 'Action impossible : mission déjà démarrée ou terminée');

-- Cas nominal, puis rejeu idempotent.
SELECT pg_temp.expect_ok('noshow: owner sur b7', $q$select public.mark_booking_no_show('b7000000-0000-4000-8000-000000000007', 'Client absent')$q$);
SELECT pg_temp.expect_ok('noshow: rejeu', $q$select public.mark_booking_no_show('b7000000-0000-4000-8000-000000000007', 'Autre motif')$q$);
RESET ROLE;

SELECT pg_temp.expect_count('noshow: b7 non réalisée', $q$select count(*) from public.bookings where id = 'b7000000-0000-4000-8000-000000000007' and status = 'no_show' and mission_note like '%[non réalisée] motif=Client absent%' and mission_note not like '%Autre motif%'$q$, 1);
SELECT pg_temp.expect_count('noshow: aucun mouvement ledger', 'select count(*) from public.financial_movements', :mvts_avant);

-- Le manager passe aussi (b2 : heure passée posée via le marqueur de confiance, comme une RPC).
SELECT set_config('vtc.trusted_rpc', 'on', true);
UPDATE public.bookings SET pickup_time = now() - interval '2 hours' WHERE id = 'b2000000-0000-4000-8000-000000000002';
SELECT set_config('vtc.trusted_rpc', '', true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('22222222-2222-4222-8222-222222222222');
SELECT pg_temp.expect_ok('noshow: manager sur b2', $q$select public.mark_booking_no_show('b2000000-0000-4000-8000-000000000002', 'Client injoignable')$q$);
RESET ROLE;
SELECT pg_temp.expect_count('noshow: b2 non réalisée', $q$select count(*) from public.bookings where id = 'b2000000-0000-4000-8000-000000000002' and status = 'no_show'$q$, 1);

DO $$ BEGIN RAISE NOTICE 'RPC no_show checks passed.'; END $$;

ROLLBACK;
