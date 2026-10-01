---
phase: 14-routes-serveur-rpc-edge-functions
plan: 03
subsystem: database
tags: [supabase, pricing, vat, lint]
requires: [14-01, 14-02]
provides:
  - public.calculate_booking_price (formule unique des écritures)
  - public.booking_vat_split (décomposition TTC, DECISION-ARRONDI V1)
  - supabase/lint/rpc_pricing_checks.sql
key-files:
  created:
    - supabase/migrations/20260929110300_booking_pricing_functions.sql
    - supabase/lint/rpc_pricing_checks.sql
  modified:
    - .planning/BACKLOG.md
    - docs/planning/BACKLOG.md
decisions:
  - DECISION-ARRONDI V1 appliquée : TVA = brut - net arrondi (33.33 à 20 % = 27.78 + 5.55)
metrics:
  tasks: 2
  completed: 2026-10-01
requirements: [P14-R3]
---

# Phase 14 Plan 03 : formule de prix et TVA en SQL

Deux fonctions SQL non SECURITY DEFINER, fermées à PUBLIC/anon/authenticated, portent la formule de `lib/pricing.ts`
pour les RPC du plan 05. Vecteurs de prix et de TVA en CI.

## Commits
- b74d4d3 test(db): vecteurs de prix et de TVA pour la formule SQL (RED, échec constaté : fonctions absentes)
- fe1c88e feat(db): formule de prix et décomposition TVA en SQL, source unique des écritures
- 14ed7d5 docs(14): dette des copies de la formule de prix

## Vérifications
- `supabase db reset --no-seed` puis `security_checks`, `rls_role_checks`, `rpc_socle_checks`, `rpc_pricing_checks` : verts.
- `has_function_privilege('authenticated', calculate_booking_price, 'EXECUTE')` = f ; 2 REVOKE, 0 SECURITY DEFINER.
- Le BACKLOG racine et celui de docs/planning sont identiques.

## Deviations from Plan
- Aucune. `STATE.md` et `ROADMAP.md` non mis à jour via gsd-tools (`.planning` est un symlink Vault, consigne du lancement).

## Known Stubs
Aucun.

## Self-Check: PASSED
