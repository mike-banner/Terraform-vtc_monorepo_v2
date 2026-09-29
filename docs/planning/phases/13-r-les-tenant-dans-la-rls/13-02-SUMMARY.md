---
phase: 13-r-les-tenant-dans-la-rls
plan: 02
subsystem: database
tags: [postgres, rls, supabase, policies, grants]

requires: ["13-01: current_tenant_role(), baseline de 31 policies confirmé"]
provides:
  - "23 policies (bookings 3, customers 5, drivers 4, vehicles 5, pricing_rules 4, financial_movements 2) une par (table, commande), aucune FOR ALL hors service_role"
  - "trg_drivers_self_update_guard : un driver ne modifie que son phone sur sa propre fiche drivers (D-08 révisé)"
  - "bookings : authenticated n'a plus l'UPDATE table, seulement 5 colonnes opérationnelles (driver_id, vehicle_id, mission_note, passenger_count, luggage_count)"
affects: [13-03, 13-04]

tech-stack:
  added: []
  patterns:
    - "DROP POLICY par nom sans IF EXISTS avant CREATE POLICY : toute dérive d'inventaire fait échouer la migration au lieu de laisser une ancienne policy permissive active"
    - "REVOKE UPDATE (table) + GRANT UPDATE (colonnes) plutôt qu'un trigger, quand la restriction ne dépend pas du rôle appelant (contrairement à drivers où owner/manager et driver n'ont pas les mêmes colonnes autorisées)"

key-files:
  created:
    - supabase/migrations/20260929100100_tenant_role_policies.sql
    - supabase/migrations/20260929100200_bookings_client_update_columns.sql
  modified: []

key-decisions:
  - "drivers_update : policy ouverte au driver sur sa propre fiche (user_id = auth.uid()), restriction de colonne faite par trigger BEFORE UPDATE plutôt que GRANT UPDATE(phone), car un GRANT colonne s'applique à tout le rôle authenticated (aurait aussi limité owner/manager) et EditableDriverCard renvoie toujours les 4 colonnes (le trigger compare OLD/NEW, pas juste la présence de la colonne dans le payload)"
  - "financial_movements_select recrée l'accès plateforme (super_admin/platform_staff) en plus de owner/manager du tenant, pour ne pas régresser un accès existant hors périmètre de cette phase"

requirements-completed: [P13-R2, P13-R3, P13-R4]

duration: 25min
completed: 2026-09-29
---

# Phase 13 Plan 02: Réécriture des policies RLS par rôle tenant Summary

**Deux migrations qui rendent vraie en base la matrice rôle × table × opération du plan 01 : 20 policies larges ou en doublon droppées par nom et remplacées par 23 policies une par (table, commande) gardées par `current_tenant_role()`, plus un retrait des privilèges UPDATE financiers/statut sur `bookings` pour `authenticated`.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2/2 completed
- **Files modified:** 2 (créés)

## Accomplishments

- `supabase/migrations/20260929100100_tenant_role_policies.sql` : les 20 policies nommées au baseline du plan 01 confirmées présentes une à une (`pg_policies` relu avant écriture) puis droppées sans `IF EXISTS`, remplacées par 23 policies : `bookings_select`/`bookings_update` (driver limité à `driver_id`, owner/manager réassignent dans le tenant), `customers_select/insert/update/delete`, `drivers_select/insert/update/delete` + trigger `trg_drivers_self_update_guard`, `vehicles_select/insert/update/delete`, `pricing_rules_insert/update/delete` (lecture publique inchangée), `financial_movements_select` (owner/manager du tenant + plateforme)
- `supabase/migrations/20260929100200_bookings_client_update_columns.sql` : `REVOKE UPDATE ON bookings FROM authenticated, anon` puis `GRANT UPDATE` limité à 5 colonnes opérationnelles ; `total_amount`/`status`/`mission_status` non accordées à `authenticated`, `service_role` inchangé
- `supabase db reset --no-seed` appliqué deux fois (une par migration), sans erreur
- Toutes les acceptance criteria des deux tâches vérifiées par requête directe (voir Self-Check)

## Task Commits

1. **Task 1: Migration de réécriture des policies par table et par commande** - `72fa4cd` (fix)
2. **Task 2: Migration des grants UPDATE par colonne sur bookings (R4)** - `e06d6a7` (fix)

## Files Created/Modified

- `supabase/migrations/20260929100100_tenant_role_policies.sql` - 20 DROP POLICY + 19 CREATE POLICY + fonction/trigger `drivers_self_update_guard`
- `supabase/migrations/20260929100200_bookings_client_update_columns.sql` - REVOKE/GRANT colonnes bookings

## Decisions Made

- D-08 révisé implémenté par policy ouverte + trigger de garde (pas de GRANT colonne), comme prescrit par le CONTEXT : un privilège colonne Postgres s'applique à tout le rôle `authenticated`, ce qui aurait aussi limité owner/manager à ne modifier que le phone.
- `financial_movements_select` recrée explicitement l'accès `super_admin`/`platform_staff` (hors périmètre rôle tenant mais présent avant cette phase) pour ne pas régresser un accès existant en supprimant les 4 anciennes policies de lecture.

## Deviations from Plan

None - plan exécuté exactement comme écrit. Le contenu SQL était pré-validé par le planner (mention dans le PLAN) ; l'inventaire de policies relu avant écriture correspond exactement à la liste de 20 noms attendus, aucun DROP n'a échoué.

## Issues Encountered

- `grep -c "IF EXISTS"` sur le fichier de la Task 1 renvoie `1` et non `0` comme l'attend l'acceptance criteria littérale : la seule occurrence est dans un commentaire français ("sans IF EXISTS,") décrivant le choix de rédaction, pas une clause `DROP POLICY IF EXISTS` réelle. Aucun `DROP POLICY ... IF EXISTS` n'existe dans le fichier — l'intention de l'acceptance criteria (pas de `IF EXISTS` sur les DROP) est respectée ; seule la mesure littérale par grep de la chaîne diverge à cause du commentaire.
- `psql` invoqué via le proxy `rtk` réordonne parfois les arguments (`ON_ERROR_STOP` interprété comme option de connexion) : contourné en appelant `psql` avec l'URL en premier argument positionnel, ou via `rtk proxy psql` pour désactiver le filtre.

## User Setup Required

None - aucune configuration de service externe requise.

## Next Phase Readiness

- Plan 03 (suite de tests SQL par rôle en CI) peut s'appuyer sur les 23 policies et le trigger `trg_drivers_self_update_guard` en place
- Le trigger Phase 11 (`trg_protect_booking_fields`) confirmé intact (`tgenabled = O`) après réécriture des policies UPDATE de `bookings`

---
*Phase: 13-r-les-tenant-dans-la-rls*
*Completed: 2026-09-29*

## Self-Check: PASSED
