---
phase: 13-r-les-tenant-dans-la-rls
plan: 03
subsystem: database
tags: [postgres, rls, supabase, ci, lint]

requires: ["13-01: current_tenant_role()", "13-02: 23 policies par (table, commande), trg_drivers_self_update_guard"]
provides:
  - "supabase/lint/rls_role_checks.sql : suite de tests SQL par rôle (owner/manager/driver/autre tenant/anon), transaction annulée, rejouable en CI"
  - "supabase/lint/security_checks.sql : règles 5 (pas de FOR ALL) et 6 (pas de doublon par commande) sur les 6 tables de la matrice"
  - "step CI « RLS role checks » dans db-lint.yml, après le lint de sécurité existant"
  - "guards.ts documente la limite réelle de R6 (ROUTE_POLICY reste la barrière des routes /api/tenant/* en service_role)"
affects: [13-04]

tech-stack:
  added: []
  patterns:
    - "Tests RLS par rôle en DO $$ / SET LOCAL ROLE / set_config(request.jwt.claims), sans pgTAP (non installé), même patron que security_checks.sql"

key-files:
  created:
    - supabase/lint/rls_role_checks.sql
  modified:
    - supabase/lint/security_checks.sql
    - .github/workflows/db-lint.yml
    - apps/vtc-backoffice/src/lib/guards.ts
    - docs/planning/ROADMAP.md
    - docs/planning/phases/13-r-les-tenant-dans-la-rls/13-RESEARCH.md

key-decisions:
  - "rls_role_checks.sql copié à l'identique depuis le fichier de référence pré-validé par le planner (aucun écart, diff vide)"
  - "R6 laissé décoché dans le ROADMAP : vrai pour les pages et les accès directs Supabase, faux pour /api/tenant/* et /api/missions/* qui tournent en service_role (BYPASSRLS) jusqu'à la Phase 14"

requirements-completed: [P13-R3, P13-R5, P13-R6]

duration: 20min
completed: 2026-09-29
---

# Phase 13 Plan 03: Tests RLS par rôle en CI et documentation ROUTE_POLICY Summary

**Suite de tests SQL par rôle (owner/manager/driver/autre tenant/anon) en transaction annulée, deux règles de lint structurelles (FOR ALL, doublons par commande) et un step CI, plus la documentation honnête de la limite de ROUTE_POLICY (R6 non coché, routes service_role hors RLS jusqu'à la Phase 14).**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3/3 completed

## Accomplishments

- `supabase/lint/rls_role_checks.sql` copié à l'identique depuis le fichier de référence validé par le planner (`diff` vide) : fixtures tenants A/B, 5 profils, drivers/vehicles/pricing/customers/bookings/financial_movements, non-régression Phase 11 (`total_amount` bloqué après `pending`), puis tous les cas D-03 à D-11 par rôle. `psql -f` sort en NOTICE `RLS role checks passed.` (confirmé via capture stdout/stderr séparée) et code 0, aucune donnée résiduelle (`RLS Test%` → 0 ligne après ROLLBACK).
- `supabase/lint/security_checks.sql` étendu : `role_tables` (les 6 tables de la matrice de rôles), règle 5 (policy `FOR ALL` hors `service_role`) et règle 6 (plusieurs policies pour la même (table, commande)). Contre-test positif : une policy `FOR ALL` ajoutée en transaction annulée fait échouer le lint avec `is FOR ALL`.
- `.github/workflows/db-lint.yml` : step « RLS role checks » ajouté dans le job `schema-security`, après le lint de sécurité et avant `Stop local stack`.
- `guards.ts` : paragraphe ajouté au JSDoc de `ROUTE_POLICY` (aucune ligne de code modifiée, vérifié par `git diff main` filtré) précisant que la RLS porte désormais les droits pour les pages/accès directs, et que ROUTE_POLICY reste la seule barrière des routes `/api/tenant/*` et `/api/missions/*` (service_role) jusqu'à la Phase 14.
- ROADMAP (`.planning/`, dupliqué dans `docs/planning/`) : statut Phase 13 passé à « In progress », requirements 1 à 5 cochés avec leur preuve, requirement 6 volontairement laissé décoché avec sa limite explicite, section « Conséquences assumées (D-08, D-09) » ajoutée, plans 3/4 exécutés.
- `docs/planning/phases/13-r-les-tenant-dans-la-rls/` resynchronisé avec `.planning/` (13-01 à 13-04, CONTEXT, DISCUSSION-LOG, RESEARCH, le fichier de référence SQL).
- CI rejouée en local, les 8 commandes passent : `supabase db reset --no-seed`, `security_checks.sql`, `rls_role_checks.sql`, `pnpm lint`, `node scripts/check-route-policy.mjs`, `tsc --noEmit` sur les 3 packages (`vtc-backoffice`, `vtc-websites`, `superadmin`).

## Task Commits

1. **Task 1: Suite de tests SQL par rôle** — `4114ea0` (test)
2. **Task 2: Règles de lint 5/6 et step CI** — `c9e6361` (ci)
3. **Task 3: ROUTE_POLICY (R6), ROADMAP et rejeu local de la CI** — `9055825` (docs)

## Files Created/Modified

- `supabase/lint/rls_role_checks.sql` — copie identique du fichier de référence pré-validé
- `supabase/lint/security_checks.sql` — `role_tables`, règles 5 et 6
- `.github/workflows/db-lint.yml` — step « RLS role checks »
- `apps/vtc-backoffice/src/lib/guards.ts` — commentaire JSDoc uniquement
- `.planning/ROADMAP.md` / `docs/planning/ROADMAP.md` — Phase 13 à jour (statut, requirements, conséquences assumées)
- `docs/planning/phases/13-r-les-tenant-dans-la-rls/` — resynchronisé avec `.planning/` (symlink Vault)

## Decisions Made

- Aucune décision architecturale nouvelle : le contenu SQL de `rls_role_checks.sql` était figé par le planner (section `<prevalidated>` du plan), copié tel quel.
- R6 explicitement laissé ouvert dans le ROADMAP plutôt que coché à tort — cohérent avec le threat T-13-14 du plan (« faux sentiment de sécurité »).

## Deviations from Plan

None — plan exécuté exactement comme écrit. Les vérifications ont montré un comportement instable du pipe `psql ... | grep` sur `rls_role_checks.sql` (NOTICE parfois absent du flux capturé par le pipe alors que la capture séparée stdout/stderr le montre bien présent, exit code 0 dans tous les cas) — contourné en capturant stdout et stderr dans des fichiers séparés pour confirmer le contenu réel, sans modifier le fichier de test ni le comportement de psql. N'affecte pas la CI (GitHub Actions capture stdout+stderr fusionnés normalement) ni le résultat des acceptance criteria, tous vérifiés positivement.

## Issues Encountered

- Flakiness observée uniquement en local sur `psql -f rls_role_checks.sql 2>&1 | grep` (probablement liée à `\o /dev/null` dans le script et au buffering du pipe Bash) : la NOTICE finale est présente sur stderr (confirmé par capture fichier séparée) mais n'apparaît pas de façon fiable dans le flux du pipe. Aucun impact sur le résultat : exit code 0 dans tous les cas, aucune exception levée, donnée de test bien annulée (ROLLBACK).

## User Setup Required

None — aucune configuration de service externe requise, tout tourne en local.

## Next Phase Readiness

- Plan 13-04 (mise en production) peut s'appuyer sur une CI locale entièrement rejouée et verte : lint de sécurité (6 règles), tests RLS par rôle, `check-route-policy.mjs`, typechecks des 3 packages.
- Le ROADMAP reflète l'état réel : R6 non coché avec sa limite documentée dans `guards.ts`, prêt pour la Phase 14 (RPC + retrait de `SUPABASE_SERVICE_ROLE_KEY`).

---
*Phase: 13-r-les-tenant-dans-la-rls*
*Completed: 2026-09-29*

## Self-Check: PASSED
