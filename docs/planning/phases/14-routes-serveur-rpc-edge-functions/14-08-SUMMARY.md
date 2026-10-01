---
phase: 14-routes-serveur-rpc-edge-functions
plan: 08
subsystem: backoffice
tags: [astro, rpc, proxy, rls]
requires: [14-04, 14-05, 14-07]
provides:
  - apps/vtc-backoffice/src/lib/rpc-error.ts (rpcErrorStatus)
  - terrain-transition, booking-actions, create-booking en proxys RPC (session utilisateur)
key-files:
  created:
    - apps/vtc-backoffice/src/lib/rpc-error.ts
  modified:
    - apps/vtc-backoffice/src/pages/api/missions/terrain-transition.ts
    - apps/vtc-backoffice/src/pages/api/tenant/booking-actions.ts
    - apps/vtc-backoffice/src/pages/api/tenant/create-booking.ts
    - apps/vtc-backoffice/src/lib/guards.ts
  deleted:
    - apps/vtc-backoffice/src/pages/api/tenant/update-booking-status.ts
decisions:
  - DECISION-CASH C1, DECISION-EDIT A, DECISION-ARRONDI V1 portées par les RPC (plans 04-05) ; les routes ne décident plus rien
metrics:
  tasks: 2
  completed: 2026-10-01
requirements: [P14-R1, P14-R2, P14-R3]
---

# Phase 14 Plan 08 : routes de course en proxys RPC

Les trois routes de course gardent leur URL et leur contrat JSON mais n'appellent plus que `locals.supabase.rpc(...)`
(JWT utilisateur, plus de `service_role`, plus d'import de `lib/pricing`). `update-booking-status` (statut libre, sans
appelant) est supprimée avec sa ligne `ROUTE_POLICY`. Front inchangé.

## Commits
- d338511 refactor(backoffice): terrain-transition et booking-actions en proxys vers les RPC
- adae4a5 refactor(backoffice): create-booking en proxy RPC, suppression de update-booking-status

## Vérifications
- `tsc --noEmit` backoffice, `pnpm lint`, `node scripts/check-route-policy.mjs` (16 chemins, aucun écart) : verts.
- Aucun `createAdminClient`, `lib/pricing`, `.from(` dans les routes réécrites ; aucune occurrence de
  `update-booking-status` dans `src` ; diff du front (scripts, dashboard.astro) vide ; 0 mention interdite dans les commits.

## Deviations from Plan
- [Rule 3] Typage : les `null` du plan sont remplacés par `undefined` pour les arguments RPC optionnels (les types
  générés n'acceptent pas `null` ; PostgREST omet la clé, le DEFAULT NULL s'applique, résultat identique).
- [Rule 3] `create-booking` : `data` inféré `unknown` après `.single()`, cast explicite vers `{ booking_id, total_price }`.
- Écart de comportement connu : les anciens messages d'erreur côté route (ex. « Motif d'annulation requis ») viennent
  désormais des messages des RPC ; statuts HTTP via `rpcErrorStatus`. À contrôler fonctionnellement au plan 11.
- `STATE.md` / `ROADMAP.md` non mis à jour via gsd-tools (`.planning` est un symlink Vault, consigne du lancement).

## Known Stubs
Aucun.

## Self-Check: PASSED
