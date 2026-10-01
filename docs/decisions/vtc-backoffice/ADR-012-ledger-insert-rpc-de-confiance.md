# ADR-012 : Encaissement du ledger ouvert aux RPC de confiance

## Statut
Accepté (2026-09-29).

## Contexte
- ADR-011 : les écritures sensibles passent par des RPC `SECURITY DEFINER`, plus de `service_role` dans Astro.
- `auto_create_financial_movement` (trigger sur `bookings`) n'autorisait l'encaissement (paiement carte, fin de
  course cash) qu'au JWT `service_role`. Une RPC appelée avec la session d'un chauffeur ou d'un gestionnaire
  garde le JWT `authenticated` même en `SECURITY DEFINER` : l'encaissement était donc refusé (42501).

## Décision
Validée par l'utilisateur le 2026-09-29 (question Q2 de 14-RESEARCH).
- Une RPC `SECURITY DEFINER` de confiance pose `set_config('vtc.trusted_rpc','on',true)` (portée : la
  transaction, jamais la connexion poolée).
- `auto_create_financial_movement` et `protect_booking_immutable_fields` acceptent ce marqueur.
- Le ledger reste immuable (aucun UPDATE/DELETE). Seul le critère d'INSERT (via trigger) s'élargit : de
  « JWT `service_role` » à « JWT `service_role` OU RPC de confiance ».
- RPC autorisées à poser le marqueur : `terrain_transition`, `update_booking_details` (plans 14-04 et 14-05).

### Pourquoi le marqueur n'est pas exploitable
`set_config` est appelable par tout rôle SQL. La sécurité ne repose donc pas sur le secret du marqueur mais sur
l'invariant : `anon` et `authenticated` n'ont aucune policy INSERT sur `bookings` / `financial_movements`, ni
aucun privilège UPDATE sur statut, montants, adresses, horaire. Aucun chemin client ne déclenche les branches
qui lisent le marqueur. Cet invariant est contrôlé en CI par la règle 10 de `supabase/lint/security_checks.sql`,
et le marqueur forgé par un client est prouvé sans effet par `supabase/lint/rpc_socle_checks.sql`.
Toute future ouverture de ces colonnes au client doit relire cet ADR.

## Conséquences
- + Un seul chemin d'écriture du ledger (le trigger), les RPC n'y insèrent pas directement.
- + Les RPC peuvent tourner avec la session de l'utilisateur, le rôle tenant reste contrôlé dans la RPC.
- − La sécurité dépend d'un invariant de privilèges : une migration qui ouvre une colonne sensible casse la CI.

## Alternatives rejetées
- Edge Function en `service_role` pour l'encaissement : contredit D-13 (plus de `service_role` côté applicatif).
- INSERT du mouvement directement dans la RPC : deux chemins d'écriture du ledger à garder cohérents.
