---
phase: 14-routes-serveur-rpc-edge-functions
plan: 04
subsystem: database
tags: [supabase, rpc, rls, ledger, lint]
requires: [14-01, 14-02, 14-03]
provides:
  - public.terrain_transition(uuid, text, timestamptz) RETURNS text
  - public.driver_cancel_booking(uuid, text) RETURNS text
  - supabase/lint/rpc_bookings_checks.sql
key-files:
  created:
    - supabase/migrations/20260929110400_rpc_terrain_transition.sql
    - supabase/migrations/20260929110410_rpc_driver_cancel_booking.sql
    - supabase/lint/rpc_bookings_checks.sql
decisions:
  - DECISION-CASH C1 appliquée : accepted>completed réservé au cash, garde 'Paiement non encaissé' sinon
metrics:
  tasks: 2
  completed: 2026-10-01
requirements: [P14-R2]
---

# Phase 14 Plan 04 : RPC de transition de course

Deux RPC SECURITY DEFINER (EXECUTE réservé à `authenticated`) qui portent la garde de rôle (chauffeur limité à ses
courses, owner/manager sur tout le tenant, 42501 sinon), l'idempotence par marqueur de note, H-15 avec date de
disponibilité en DETAIL, l'encaissement cash via le marqueur `vtc.trusted_rpc` (posé puis remis à vide), et la règle
d'annulation tardive codée dans la RPC (les triggers sont désactivés en prod).

## Commits
- a16f7df test(db): matrice terrain_transition par rôle (RED : fonction absente)
- 9cd71e6 feat(db): RPC terrain_transition gardée par rôle et idempotente
- eb632cf test(db): matrice driver_cancel_booking, triggers actifs et désactivés (RED : fonction absente)
- f8fe417 feat(db): RPC driver_cancel_booking gardée par rôle

## Vérifications
- `supabase db reset --no-seed` puis `security_checks`, `rls_role_checks`, `rpc_bookings_checks`, `rpc_pricing_checks`,
  `rpc_socle_checks` : verts.
- Un seul `cash_completion` pour b5 après rejeu ; b6 (carte payée) sans nouveau mouvement ; aucune annulation
  ne crée de mouvement ; annulation de b7 refusée trigger actif ET `trg_prevent_late_cancellation` désactivé.
- Critères d'acceptation grep : tous conformes (DECISION-CASH: C1 = 1, marqueur remis à vide = 1, pickup_time <= now() = 1,
  aucun trusted_rpc ni cancellation_policy_id dans la RPC d'annulation, 0 mention interdite dans les commits).

## Deviations from Plan
- Mineure : dans la suite, la comparaison du ledger de b6 utilise un comptage direct (`:b6_mvts_avant` via `\gset`) ;
  aucun écart de comportement. `STATE.md` / `ROADMAP.md` non mis à jour via gsd-tools (`.planning` est un symlink
  Vault, consigne du lancement).

## Known Stubs
Aucun.

## Self-Check: PASSED
