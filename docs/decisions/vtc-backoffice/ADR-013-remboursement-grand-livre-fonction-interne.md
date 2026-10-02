# ADR-013 : Remboursement au grand livre par une fonction interne unique

## Statut
Accepté (2026-10-02).

## Contexte
- ADR-012 : le ledger `financial_movements` est alimenté par le trigger `auto_create_financial_movement`,
  qui ne connaît que les encaissements (paiement carte, fin de course cash).
- Un remboursement, souvent partiel, n'est pas une colonne de la course : il ne peut pas naître d'un changement
  de statut. Il faut une écriture directe, sans rouvrir le ledger aux clients ni à `service_role`.

## Décision
- Une fonction interne `public.ledger_insert_refund(booking, montant, stripe_refund_id, événement, payment_intent)`,
  `SECURITY DEFINER`, dont l'EXECUTE est retiré à `PUBLIC`, `anon`, `authenticated` et `service_role`.
- Elle n'est appelée que par des fonctions définies : `record_booking_refund` (remboursement Stripe, EXECUTE
  réservé à `service_role`) et `issue_credit_note` (avoir, plan 04).
- Elle écrit un mouvement `refund` / `debit`, TVA au prorata de la course, `refund_ratio` renseigné.
- Garde : somme des remboursements + nouveau montant <= somme des encaissements, sinon erreur 22023.
- Idempotence : index unique `idx_unique_financial_payment` (payment intent, type, refund id) ; un rejeu du même
  `re_…` est absorbé par l'appelant, jamais un doublon.
- ADR-012 inchangé : le marqueur `vtc.trusted_rpc` reste le chemin des encaissements ; ceci est un second chemin,
  distinct et plus étroit.

## Conséquences
- + Le ledger reste immuable (INSERT seulement) ; aucun client ni service_role n'écrit un remboursement en direct.
- + Un seul endroit calcule la TVA et le ratio d'un remboursement.
- - Deux chemins d'écriture à connaître (trigger d'encaissement, fonction de remboursement) ; la suite
  `supabase/lint/rpc_cancel_checks.sql` vérifie les droits et l'idempotence.
