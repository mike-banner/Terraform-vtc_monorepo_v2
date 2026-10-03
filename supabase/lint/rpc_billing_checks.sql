-- Facturation (phase 14.1, plan 04) : adresse du vendeur, numéro FAC- dans la transaction, avoirs AV-, ledger.
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

-- Courses de test : p1 carte payée et terminée, t1 transfert au km non validé.
INSERT INTO public.bookings (id, original_tenant_id, current_tenant_id, customer_id, vehicle_id, driver_id, status,
  payment_mode, stripe_payment_intent_id, pickup_time, mission_status, pickup_address, dropoff_address, total_amount,
  subtotal_amount, vat_amount, booking_type, booking_source, pricing_mode, distance_km) VALUES
  ('a1000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'c1000000-0000-4000-8000-00000000000a', 'ee000000-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-000000000001',
   'paid', 'stripe', 'pi_test_p1', now() - interval '1 day', 'completed', 'A', 'B', 100, 90.91, 9.09, 'transfer', 'manual_driver', 'direct', NULL),
  ('a2000000-0000-4000-8000-0000000000a2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'c1000000-0000-4000-8000-00000000000a', 'ee000000-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-000000000001',
   'completed', 'cash', NULL, now() - interval '1 day', 'completed', 'A', 'B', 50, 45.45, 4.55, 'transfer', 'manual_driver', 'direct', 12);

SELECT extract(year FROM now() AT TIME ZONE 'Europe/Paris')::int AS yr \gset

-- ===== update_tenant_address ======================================================================
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('22222222-2222-4222-8222-222222222222');
SELECT pg_temp.expect_sqlstate('address: manager refusé', $q$select public.update_tenant_address('1 rue X','75001','Paris')$q$, '42501');
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_error('address: vide', $q$select public.update_tenant_address('1 rue X','','Paris')$q$, '22023', 'Adresse incomplète');

-- ===== assign_invoice_number ======================================================================
SELECT pg_temp.expect_error('assign: sans adresse',
  $q$select * from public.assign_invoice_number('b8000000-0000-4000-8000-000000000008')$q$, '22023',
  'Adresse de l''entreprise manquante : compléter les Réglages');
SELECT public.update_tenant_address('1 rue de la Paix', '75002', 'Paris');
SELECT pg_temp.expect_count('assign: b8 = FAC-0001',
  format($q$select count(*) from public.assign_invoice_number('b8000000-0000-4000-8000-000000000008') where invoice_number = 'FAC-%s-0001' and invoice_created_at is not null$q$, :yr), 1);
SELECT pg_temp.expect_count('assign: rejeu = même numéro',
  format($q$select count(*) from public.assign_invoice_number('b8000000-0000-4000-8000-000000000008') where invoice_number = 'FAC-%s-0001'$q$, :yr), 1);
SELECT pg_temp.expect_count('assign: p1 = FAC-0002',
  format($q$select count(*) from public.assign_invoice_number('a1000000-0000-4000-8000-0000000000a1') where invoice_number = 'FAC-%s-0002'$q$, :yr), 1);
SELECT pg_temp.expect_error('assign: course non terminée', $q$select * from public.assign_invoice_number('b1000000-0000-4000-8000-000000000001')$q$,
  '22023', 'Course non facturable : elle doit être terminée');
SELECT pg_temp.expect_error('assign: prix au km', $q$select * from public.assign_invoice_number('a2000000-0000-4000-8000-0000000000a2')$q$,
  '22023', 'Prix au kilomètre non validé : valider le montant avant la facture');
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_sqlstate('assign: driver refusé', $q$select * from public.assign_invoice_number('b8000000-0000-4000-8000-000000000008')$q$, '42501');
SELECT pg_temp.login('55555555-5555-4555-8555-555555555555');
SELECT pg_temp.expect_sqlstate('assign: owner B', $q$select * from public.assign_invoice_number('b8000000-0000-4000-8000-000000000008')$q$, 'P0002');
SELECT pg_temp.expect_sqlstate('credit_note_remaining: owner B', $q$select public.credit_note_remaining('a1000000-0000-4000-8000-0000000000a1')$q$, 'P0002');

-- Les refus n'ont consommé aucun numéro : la course suivante prend -0003.
RESET ROLE;
SELECT set_config('request.jwt.claims', '{}', true);
INSERT INTO public.bookings (id, original_tenant_id, current_tenant_id, customer_id, vehicle_id, driver_id, status,
  payment_mode, pickup_time, mission_status, pickup_address, dropoff_address, total_amount, subtotal_amount, vat_amount,
  booking_type, booking_source, pricing_mode) VALUES
  ('a3000000-0000-4000-8000-0000000000a3', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'c1000000-0000-4000-8000-00000000000a', 'ee000000-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-000000000001',
   'completed', 'cash', now() - interval '1 day', 'completed', 'A', 'B', 20, 18.18, 1.82, 'transfer', 'manual_driver', 'direct');
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('22222222-2222-4222-8222-222222222222');
SELECT pg_temp.expect_count('assign: manager, sans trou = FAC-0003',
  format($q$select count(*) from public.assign_invoice_number('a3000000-0000-4000-8000-0000000000a3') where invoice_number = 'FAC-%s-0003'$q$, :yr), 1);

-- ===== avoirs =====================================================================================
SELECT pg_temp.login('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect_error('credit: sans facture', $q$select * from public.issue_credit_note('b1000000-0000-4000-8000-000000000001', 10, 'x')$q$, '22023', 'Facture requise');
SELECT pg_temp.expect_error('remaining: sans facture', $q$select public.credit_note_remaining('b1000000-0000-4000-8000-000000000001')$q$, '22023', 'Facture requise');
SELECT pg_temp.expect_error('credit: zéro', $q$select * from public.issue_credit_note('a1000000-0000-4000-8000-0000000000a1', 0, 'x')$q$, '22023', 'Montant invalide');
SELECT pg_temp.expect_error('credit: négatif', $q$select * from public.issue_credit_note('a1000000-0000-4000-8000-0000000000a1', -5, 'x')$q$, '22023', 'Montant invalide');
SELECT pg_temp.expect_error('credit: motif vide', $q$select * from public.issue_credit_note('a1000000-0000-4000-8000-0000000000a1', 5, '  ')$q$, '22023', 'Motif requis (500 caractères maximum)');
SELECT pg_temp.expect_count('remaining: 100 avant avoir', $q$select count(*) from public.credit_note_remaining('a1000000-0000-4000-8000-0000000000a1') r where r = 100$q$, 1);

-- Échec après le numéro : tout est annulé, aucun numéro consommé.
DO $$ BEGIN
  BEGIN
    PERFORM * FROM public.issue_credit_note('b8000000-0000-4000-8000-000000000008', 10, 'essai');
    RAISE EXCEPTION 'boom';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
END $$;
SELECT pg_temp.expect_count('credit: échec = rien d''écrit', $q$select count(*) from public.credit_notes$q$, 0);

SELECT pg_temp.expect_count('credit: 30 = AV-0001',
  format($q$select count(*) from public.issue_credit_note('a1000000-0000-4000-8000-0000000000a1', 30, 'geste') where number = 'AV-%s-0001' and payment_intent_id = 'pi_test_p1'$q$, :yr), 1);
SELECT pg_temp.expect_count('remaining: 70', $q$select count(*) from public.credit_note_remaining('a1000000-0000-4000-8000-0000000000a1') r where r = 70$q$, 1);
SELECT pg_temp.expect_count('credit: 70 = AV-0002',
  format($q$select count(*) from public.issue_credit_note('a1000000-0000-4000-8000-0000000000a1', 70, 'solde') where number = 'AV-%s-0002'$q$, :yr), 1);
SELECT pg_temp.expect_count('remaining: 0', $q$select count(*) from public.credit_note_remaining('a1000000-0000-4000-8000-0000000000a1') r where r = 0$q$, 1);
SELECT pg_temp.expect_error('credit: au-delà du reste', $q$select * from public.issue_credit_note('a1000000-0000-4000-8000-0000000000a1', 0.01, 'x')$q$, '22023', 'Montant supérieur au reste à créditer');
SELECT pg_temp.expect_count('credit: ventilation 30 = 27.27 + 2.73',
  $q$select count(*) from public.credit_notes where amount_ttc = 30 and amount_ht = 27.27 and vat_amount = 2.73$q$, 1);
SELECT pg_temp.expect_count('credit: owner A voit 2 avoirs', $q$select count(*) from public.credit_notes$q$, 2);

-- Immuabilité et droits
SELECT pg_temp.expect_denied('credit: INSERT direct', $q$insert into public.credit_notes (tenant_id, booking_id, number, invoice_number, amount_ttc, amount_ht, vat_amount, reason, created_by)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-0000000000a1','AV-X','FAC-X',1,1,0,'x','11111111-1111-4111-8111-111111111111')$q$);
SELECT pg_temp.expect_denied('credit: UPDATE direct', $q$update public.credit_notes set reason = 'y'$q$);
SELECT pg_temp.expect_denied('credit: DELETE direct', $q$delete from public.credit_notes$q$);
SELECT pg_temp.expect_denied('credit_note_sequences: lecture', $q$select * from public.credit_note_sequences$q$);
SELECT pg_temp.expect_denied('credit_note_sequences: écriture', $q$update public.credit_note_sequences set last_seq = 0$q$);
SELECT pg_temp.login('33333333-3333-4333-8333-333333333333');
SELECT pg_temp.expect_count('credit: driver ne voit rien', $q$select count(*) from public.credit_notes$q$, 0);
SELECT pg_temp.expect_sqlstate('credit: driver refusé', $q$select * from public.issue_credit_note('a1000000-0000-4000-8000-0000000000a1', 1, 'x')$q$, '42501');
SELECT pg_temp.expect_sqlstate('remaining: driver refusé', $q$select public.credit_note_remaining('a1000000-0000-4000-8000-0000000000a1')$q$, '42501');
SELECT pg_temp.login('55555555-5555-4555-8555-555555555555');
SELECT pg_temp.expect_count('credit: owner B ne voit rien', $q$select count(*) from public.credit_notes$q$, 0);
SELECT pg_temp.expect_sqlstate('credit: owner B refusé', $q$select * from public.issue_credit_note('a1000000-0000-4000-8000-0000000000a1', 1, 'x')$q$, 'P0002');

RESET ROLE;
SELECT pg_temp.expect_sqlstate('credit: UPDATE postgres (trigger)', $q$update public.credit_notes set reason = 'y'$q$, 'P0001');
SELECT pg_temp.expect_count('ledger: 2 refund debit sans PI, évènement avoir',
  $q$select count(*) from public.financial_movements where booking_id = 'a1000000-0000-4000-8000-0000000000a1'
     and movement_type = 'refund' and direction = 'debit' and stripe_payment_intent_id is null
     and created_by_event like 'credit_note:%' and gross_amount in (30, 70)$q$, 2);
SELECT pg_temp.expect_count('ledger: solde p1 = 0',
  $q$select count(*) from (select 1 from public.financial_movements where booking_id = 'a1000000-0000-4000-8000-0000000000a1'
     having sum(case when direction = 'credit' then gross_amount else -gross_amount end) = 0) x$q$, 1);

SELECT pg_temp.expect_count('droits: anon n''exécute pas credit_note_remaining',
  $q$select count(*) where has_function_privilege('anon', 'public.credit_note_remaining(uuid)', 'EXECUTE')$q$, 0);
SELECT pg_temp.expect_count('droits: authenticated n''exécute pas next_invoice_number',
  $q$select count(*) where has_function_privilege('authenticated', 'public.next_invoice_number(uuid,integer)', 'EXECUTE')$q$, 0);
SELECT pg_temp.expect_count('storage: invoices_service_insert réservé à service_role',
  $q$select count(*) from pg_policies where policyname = 'invoices_service_insert' and roles = '{service_role}'$q$, 1);
SELECT pg_temp.expect_count('email_logs: types autorisés',
  $q$select count(*) from pg_constraint where conname = 'email_logs_email_type_check'
     and pg_get_constraintdef(oid) like '%credit_note%' and pg_get_constraintdef(oid) like '%booking_confirmation%'$q$, 1);

ROLLBACK;
\o
\echo rpc_billing_checks: OK
