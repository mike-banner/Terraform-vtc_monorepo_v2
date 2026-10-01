---
phase: 14-routes-serveur-rpc-edge-functions
plan: 02
subsystem: database
tags: [supabase, rls, ledger, lint, adr]
requires: [14-01]
provides:
  - table booking_status_transitions peuplée par migration (14 lignes, C1)
  - marqueur vtc.trusted_rpc accepté par auto_create_financial_movement et protect_booking_immutable_fields
  - supabase/lint/_rpc_fixtures.sql (helpers pg_temp et fixtures partagées)
  - règles 7 à 10 de security_checks.sql, step CI "RPC role checks"
key-files:
  created:
    - supabase/migrations/20260929110000_seed_booking_status_transitions.sql
    - supabase/migrations/20260929110100_booking_transition_accepted_completed.sql
    - supabase/migrations/20260929110200_trusted_rpc_marker.sql
    - supabase/lint/_rpc_fixtures.sql
    - supabase/lint/rpc_socle_checks.sql
    - docs/decisions/vtc-backoffice/ADR-012-ledger-insert-rpc-de-confiance.md
  modified:
    - supabase/lint/security_checks.sql
    - .github/workflows/db-lint.yml
    - apps/vtc-backoffice/CLAUDE.md
    - .claude/CLAUDE.md (non versionné, voir ci-dessous)
decisions:
  - DECISION-CASH C1 appliquée : transition accepted>completed ajoutée
metrics:
  tasks: 3
  completed: 2026-10-01
---

# Phase 14 Plan 02 : socle SQL des RPC

Transitions de statut versionnées, marqueur de confiance transactionnel pour les RPC, lint et test de forge
prouvant que le marqueur n'ouvre rien à un client, ADR-012.

## Commits
- 32a3630 feat(db): transitions de statut versionnées et marqueur de confiance pour les RPC
- f565aa5 test(db): fixtures RPC, test de forge du marqueur et lint des triggers bookings
- dfc9d97 docs: ADR-012, encaissement ledger ouvert aux RPC de confiance

## Vérifications
- `supabase db reset --no-seed` : 14 transitions, 2 fonctions contenant `vtc.trusted_rpc`.
- Préconditions de la migration 110200 : FUNCDEF-PROD-LOCAL identique (1 occurrence) ; empreintes locales
  ee9e0f53... et 5a36297... identiques à 14-01 avant remplacement.
- `security_checks.sql`, `rpc_socle_checks.sql`, `rls_role_checks.sql` : verts.
- Contre-épreuve : trigger `trg_prevent_policy_update` désactivé -> lint en échec avec son nom ; réactivé ensuite.

## Deviations from Plan
- Le fichier `.claude/CLAUDE.md` est dans `.gitignore` (`.claude/`) : la règle ledger y est bien remplacée sur
  disque mais le changement n'est pas versionné ; seul `apps/vtc-backoffice/CLAUDE.md` est commité. À décider :
  versionner la règle racine ailleurs (ex. CLAUDE.md à la racine) ou accepter que ce fichier reste local.
- Fixtures : colonnes `vehicles.category`/`driver_id`, `pricing_rules.price_per_hour` et `vehicle_id` des courses
  utilisées conformément au plan ; le client du tenant B (`c1000000-...-00000000000b`) est ajouté pour la course bb.

## Known Stubs
Aucun.

## Self-Check: PASSED
