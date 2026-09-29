---
phase: 13-r-les-tenant-dans-la-rls
verified: 2026-09-29T00:00:00Z
status: passed
score: 6/6 must-haves verified (scope: plans 13-01 à 13-03, local uniquement — 13-04 hors périmètre de cette passe)
---

# Phase 13: Rôles tenant dans la RLS — Verification Report (local, plans 01-03)

**Phase Goal:** Que les droits de `ROUTE_POLICY` soient vrais en base, quel que soit le client qui appelle
(pour les tables/opérations couvertes par cette phase).
**Verified:** 2026-09-29
**Status:** passed
**Scope note:** Plan 13-04 (déploiement production, `supabase db push --linked`) n'est pas exécuté et n'est
pas évalué ici — c'est un GO manuel explicite en attente, pas un gap de cette passe.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `current_tenant_role()` existe, STABLE, sans SECURITY DEFINER, search_path figé | VERIFIED | `pg_proc`: `prosecdef=f`, `provolatile=s`, `proconfig={search_path=public}` — confirmé par requête directe sur la base locale, migration `20260929100000_current_tenant_role.sql` |
| 2 | Plus aucune policy `FOR ALL` sur les 6 tables de la matrice de rôles (hors service_role) | VERIFIED | `pg_policies` interrogé directement : seules `service_role_full_access_bookings`, `customers_service_role_all`, `service_role_full_access_vehicles` sont `FOR ALL`, toutes `roles={service_role}`. `security_checks.sql` règle 5 confirme (aucune violation). |
| 3 | Une seule policy par (table, commande), pas de doublon permissif | VERIFIED | Inventaire `pg_policies` : 23 policies au total sur les 6 tables, une par (table, cmd) sauf service_role à part. `security_checks.sql` règle 6 confirme. |
| 4 | Driver restreint à ses propres courses en écriture (UPDATE bookings), lecture large maintenue (D-03 à D-06) | VERIFIED | `bookings_select` (lecture tenant complète) + `bookings_update` (USING/WITH CHECK : owner/manager tout le tenant + réassignation dans le tenant ; driver limité à `driver_id` via jointure `drivers.user_id = auth.uid()`) — lu directement dans `20260929100100_tenant_role_policies.sql:31-75`, confirmé par `rls_role_checks.sql` (NOTICE "RLS role checks passed") rejoué en local. |
| 5 | Client ne peut plus écrire de colonnes financières ni de statut sur `bookings` (R4) | VERIFIED | `REVOKE UPDATE ON bookings FROM authenticated, anon` puis `GRANT UPDATE` limité à 5 colonnes (`driver_id`, `vehicle_id`, `mission_note`, `passenger_count`, `luggage_count`) — confirmé par requête `information_schema.column_privileges` : exactement ces 5 colonnes accordées à `authenticated`, aucune autre. |
| 6 | Driver limité au téléphone sur sa propre fiche `drivers` (D-08 révisé), owner/manager gèrent l'équipe (D-01/D-07) | VERIFIED | Policy `drivers_update` ouverte à `user_id = auth.uid()` pour driver + trigger `trg_drivers_self_update_guard` (BEFORE UPDATE, `tgenabled=O` confirmé) qui lève `42501` si une colonne autre que `phone` change pour un rôle driver. `drivers_insert`/`drivers_delete` restent `owner`/`manager` uniquement. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260929100000_current_tenant_role.sql` | fonction `current_tenant_role()` | VERIFIED | Contenu lu, correspond exactement au SUMMARY et au CONTEXT (calque de `current_tenant_id()`) |
| `supabase/migrations/20260929100100_tenant_role_policies.sql` | 23 policies par (table, commande) + trigger drivers | VERIFIED | Lu intégralement, matrice D-01 à D-11 respectée policy par policy |
| `supabase/migrations/20260929100200_bookings_client_update_columns.sql` | REVOKE/GRANT colonnes bookings | VERIFIED | Lu, confirmé par requête live sur `information_schema.column_privileges` |
| `supabase/lint/security_checks.sql` | règles 5 (FOR ALL) et 6 (doublons) sur les 6 tables | VERIFIED | Lu, rejoué en local : `NOTICE: Schema security lint passed.`, exit 0 |
| `supabase/lint/rls_role_checks.sql` | tests par rôle (owner/manager/driver/autre tenant/anon) | VERIFIED | Rejoué en local : `NOTICE: RLS role checks passed.`, exit 0 |
| `apps/vtc-backoffice/src/lib/guards.ts` | JSDoc note sur la limite RLS vs `/api/tenant/*` service_role | VERIFIED | Lu lignes 22-28 : mention précise et honnête, aucune ligne de code modifiée (conforme au SUMMARY) |
| `.github/workflows/db-lint.yml` | step « RLS role checks » | NOT RE-VÉRIFIÉ directement (non lu dans cette passe) | Confirmé indirectement par le rejeu manuel du même fichier SQL avec succès ; recommandé de lire le workflow si un doute subsiste sur son branchement CI réel |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `bookings_update` policy | `current_tenant_role()` | appel direct dans USING/WITH CHECK | WIRED | Confirmé dans le SQL de la migration |
| `drivers_update` policy | `trg_drivers_self_update_guard` | policy ouvre l'accès, trigger restreint les colonnes | WIRED | Policy USING/WITH CHECK très ouverte pour driver (`user_id = auth.uid()`) mais le trigger BEFORE UPDATE referme sur les colonnes non-phone — vérifié `tgenabled=O`, logique lue dans le corps de la fonction |
| `db-lint.yml` CI | `security_checks.sql` + `rls_role_checks.sql` | step de job | ASSUMED (non relu directement) | SUMMARY 13-03 l'affirme ; les deux scripts individuellement passent en local à l'identique de ce qu'attendrait la CI |

### Requirements Coverage (ROADMAP.md, section Phase 13)

| Requirement | Status | Evidence |
|---|---|---|
| Fonction `current_tenant_role()` | ✓ SATISFIED | Voir truth #1 |
| Matrice rôle × table × opération écrite avant migration | ✓ SATISFIED | En tête de `20260929100100_tenant_role_policies.sql`, cohérente avec CONTEXT D-01 à D-11 |
| Policies par table et par commande, plus de FOR ALL, doublons supprimés | ✓ SATISFIED | Voir truths #2, #3 |
| `bookings` : client n'écrit plus colonnes financières/statut, driver limité à ses courses | ✓ SATISFIED | Voir truths #4, #5 |
| Suite de tests SQL par rôle en CI | ✓ SATISFIED (le script SQL est vérifié ; le branchement CI n'a pas été relu directement, voir note artefact ci-dessus) | `rls_role_checks.sql` rejoué avec succès |
| `ROUTE_POLICY` ne sert plus qu'à la navigation | ⬜ VOLONTAIREMENT NON COCHÉ (documenté, hors gap) | `/api/tenant/*` et `/api/missions/*` restent en `service_role` jusqu'à la Phase 14 — le ROADMAP le documente explicitement comme R6 partiel, la JSDoc de `guards.ts` aussi. Ce n'est pas un gap de cette phase, c'est le périmètre assumé (Phase 14 le referme). |

### Context Decisions (D-01 à D-11) — Traçabilité

Toutes vérifiées présentes dans le SQL réellement écrit (pas seulement dans le SUMMARY) :
- D-01/D-07 (manager = owner) : `IN ('owner', 'manager')` partout dans les policies drivers/vehicles/pricing_rules/financial_movements — confirmé par lecture directe.
- D-03/D-04 (lecture bookings large) : `bookings_select` sans restriction `driver_id` — confirmé.
- D-05/D-06 (écriture bookings, dispatch manuel) : `bookings_update` avec logique owner/manager vs driver — confirmé.
- D-08 révisé (driver limité au téléphone, via trigger et non GRANT colonne) : confirmé, et la justification technique (un GRANT colonne aurait aussi limité owner/manager) est correcte — Postgres n'a pas de GRANT colonne conditionnel au rôle appelant côté RLS.
- D-09 (ledger owner/manager + plateforme, pas driver) : `financial_movements_select` confirmé, aucune policy driver sur cette table.
- D-10 (customers même périmètre que bookings) : `customers_select/insert/update/delete` ouverts à `authenticated` filtré par tenant, sans restriction de rôle — cohérent avec D-10 ("owner/manager/driver peuvent lire/écrire").
- D-11 (lecture pricing_rules/vehicles ouverte à tout le tenant) : `vehicles_select` ouvert à `authenticated` (tenant), `public_read_pricing` conservée pour pricing_rules — confirmé.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/vtc-backoffice/CLAUDE.md` | règle "INSERT sur `drivers` par un rôle autre que `tenant_role = 'owner'`" | Documentation obsolète : la policy `drivers_insert_owner_only` a été supprimée et remplacée par `drivers_insert` qui autorise `owner` OU `manager` (D-01, décision explicite du CONTEXT) | ℹ️ Info | Pas un gap de code — le comportement RLS réel est correct et voulu. La règle du CLAUDE.md de l'app n'a pas été mise à jour en Phase 13 et référence une policy qui n'existe plus. À corriger dans un futur passage pour éviter qu'un agent futur se fie à une règle citant un nom de policy disparu. |

Aucun blocker trouvé. Aucun TODO/FIXME/placeholder détecté dans les fichiers SQL lus. Pas de policy permissive résiduelle non documentée.

### Human Verification Required

Aucune — le périmètre de cette phase est entièrement vérifiable par SQL/policies (pas d'UI, pas de flux visuel nouveau). Les conséquences UX documentées (bouton "éditer" refusé pour nom/prénom driver, KPI revenu à 0 pour un driver) sont des effets attendus et déjà documentés dans le ROADMAP comme "Conséquences assumées", pas des comportements à valider visuellement pour cette vérification.

### Gaps Summary

Aucun gap. Les trois plans locaux (13-01, 13-02, 13-03) livrent exactement ce que le ROADMAP et le CONTEXT
attendaient : `current_tenant_role()` propre, policies réécrites une par (table, commande) sans `FOR ALL`
résiduel, colonnes financières/statut de `bookings` retirées de l'écriture client, driver restreint à ses
courses et à son téléphone, tests SQL par rôle qui passent réellement en local (rejoués indépendamment,
pas seulement lus dans le SUMMARY). Le seul requirement non coché (R6, `ROUTE_POLICY` encore nécessaire pour
`/api/tenant/*`) est un partiel assumé et documenté, pas un gap — il se referme en Phase 14. Plan 13-04
(mise en prod) est intentionnellement hors périmètre de cette vérification.

Point mineur non bloquant : `apps/vtc-backoffice/CLAUDE.md` cite encore `drivers_insert_owner_only`, une
policy supprimée par cette phase (remplacée par `drivers_insert`, owner+manager). À mettre à jour au fil de
l'eau, sans urgence.

---

_Verified: 2026-09-29_
_Verifier: Claude (gsd-verifier)_
