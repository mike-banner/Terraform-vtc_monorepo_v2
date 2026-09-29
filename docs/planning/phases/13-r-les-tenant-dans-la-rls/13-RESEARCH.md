# Phase 13: Rôles tenant dans la RLS - Research

**Researched:** 2026-09-29
**Domain:** PostgreSQL RLS (multi-rôle, multi-commande), Supabase, CI SQL testing
**Confidence:** HIGH (patterns codebase vérifiés par lecture directe des migrations) / MEDIUM (recommandation CI, non vérifiée par exécution)

## Summary

Le problème est déjà entièrement diagnostiqué et décidé (CONTEXT.md D-01 à D-11). Ce qui manque au planner n'est pas la matrice de droits mais (1) l'inventaire exact des policies existantes à supprimer (doublons), (2) le modèle exact de `current_tenant_id()` à répliquer pour `current_tenant_role()`, (3) la raison technique pour laquelle `FOR ALL` + policies permissives multiples sont dangereuses en Postgres (pour que les tâches de réécriture ne réintroduisent pas le bug), et (4) un choix d'outillage de test SQL par rôle — pgTAP n'est pas installé dans ce projet, donc la suite CI doit être construite sur le même patron que `supabase/lint/security_checks.sql` (SQL brut + `DO $$ ... $$`), pas sur pgTAP.

**Primary recommendation:** Modéliser `current_tenant_role()` en SQL `STABLE` simple (pas PL/pgSQL, pas SECURITY DEFINER si évitable — voir Pitfall 1) sur le calque exact de `current_tenant_id()` ; réécrire une policy par (table, commande) en supprimant explicitement toutes les policies dupliquées identifiées ci-dessous ; construire la suite de tests par rôle en SQL brut avec `SET ROLE authenticated` + `SET request.jwt.claims` (pattern Supabase standard), ajoutée comme nouveau step dans `db-lint.yml`, pas comme nouveau framework.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: `manager` a exactement les mêmes droits que `owner` sur toutes les tables de cette phase (`vehicles`, `pricing_rules`, `drivers`, `financial_movements` lecture), y compris gestion d'équipe (`drivers` INSERT/UPDATE/DELETE).
- D-02: `settings`/`setup` restent owner seul — hors périmètre RLS (ce sont des pages, pas des tables).
- D-03/D-04: `bookings` SELECT — `driver` voit toutes les courses du tenant (pas de filtre `driver_id`), inchangé. `owner`/`manager` inchangé.
- D-05: `bookings` UPDATE — `driver` restreint à `driver_id = lui`.
- D-06: `bookings` UPDATE — `owner`/`manager` gardent l'écriture large, y compris réassignation de `driver_id` (dispatch manuel), dès cette phase (pas d'attente de la RPC Phase 14). Colonnes financières/statut restent protégées par `protect_booking_immutable_fields` (déjà en place, ne pas casser).
- D-07/D-08: `drivers` — écriture (INSERT/UPDATE/DELETE) réservée owner/manager ; `driver` n'a aucun droit d'écriture, ni sur sa propre fiche.
- D-09: `financial_movements` lecture réservée owner/manager ; driver aucun accès, même à ses propres commissions. Écriture déjà verrouillée service_role (Phase 12), hors périmètre.
- D-10: `customers` — même périmètre que `bookings` : owner/manager/driver lisent/écrivent, pas de restriction supplémentaire pour driver.
- D-11: `pricing_rules`/`vehicles` SELECT ouvert à tout le tenant (owner/manager/driver) ; écriture réservée owner/manager.

### Claude's Discretion
- `cancellation_policies`, `zones`, `fixed_routes` : déjà lisibles par anon/authenticated (Phase 12, tunnel public) — appliquer le principe général (lecture large tenant, écriture owner/manager) sauf contre-indication trouvée en recherche. **Recherche : aucune contre-indication trouvée** — ces tables n'ont pas de policy `_isolation`/`_tenant_isolation` dans le grep effectué ; le planner doit vérifier leur état RLS actuel avant d'écrire des policies (elles pourraient n'avoir aucune policy tenant du tout aujourd'hui, ce qui est un existant distinct à documenter, pas à confondre avec un doublon).
- Détail syntaxique des policies (nommage, une policy par opération vs regroupement) : au planner/executor, tant que `FOR ALL` disparaît et que les doublons sont supprimés.

### Deferred Ideas (OUT OF SCOPE)
- RPC de dispatch formalisée (notification, historique de réassignation) — Phase 14.
- Droits fins du rôle `manager` au-delà de la parité avec `owner` — non demandé, suivi BACKLOG.md.

## Phase Requirements

| ID (ROADMAP checklist) | Description | Research Support |
|----|-------------|------------------|
| R1 | `current_tenant_role()` STABLE/SECURITY DEFINER/search_path figé, modèle `current_tenant_id()` | Voir Code Examples — `current_tenant_id()` est en réalité SQL `STABLE` **sans** SECURITY DEFINER dans le code actuel (le ROADMAP dit SECURITY DEFINER mais la fonction réelle ne l'est pas) — voir Pitfall 1, divergence à trancher par le planner |
| R2 | Matrice rôle × table × opération dérivée de `ROUTE_POLICY`, validée | Déjà faite dans CONTEXT.md (D-01 à D-11) — le planner n'a plus qu'à la transcrire en tableau SQL |
| R3 | Réécriture policies par table/commande, suppression doublons | Voir Runtime State Inventory — liste exacte des policies à `DROP` par table |
| R4 | `bookings` : pas d'écriture financière/statut directe, driver limité à `driver_id` | `protect_booking_immutable_fields` déjà en place (Phase 11) — ne pas dupliquer, juste préserver au moment de réécrire `bookings_update_isolation` |
| R5 | Suite de tests SQL par rôle en CI (`db-lint.yml`) | Voir Validation Architecture — pas de pgTAP installé, construire sur le patron `security_checks.sql` |
| R6 | `ROUTE_POLICY` ne sert plus qu'à la navigation | Pas d'action SQL — vérification finale que toute route couverte par CONTEXT.md a un équivalent RLS |

## Architecture Patterns

### Pourquoi `FOR ALL` + policies permissives multiples cassent tout (déjà prouvé dans ce projet)

Postgres RLS : sur une même table et une même commande, si plusieurs policies **permissives** existent (le mode par défaut, pas `RESTRICTIVE`), elles sont combinées avec **OR**. Une policy `FOR ALL USING (tenant_id = current_tenant_id())` couvre implicitement SELECT/INSERT/UPDATE/DELETE. Si une deuxième policy plus étroite existe sur la même table pour une commande (ex. `drivers_insert_owner_only` limitant l'INSERT à owner), elle n'apporte **aucune restriction supplémentaire** : Postgres autorise l'opération dès qu'**une seule** policy permissive dit oui. C'est exactement le bug déjà diagnostiqué (`drivers_insert_owner_only` sans effet à cause de `drivers_isolation` en `FOR ALL`).

**Conséquence pour le planner :** toute nouvelle policy restrictive doit être accompagnée de la **suppression** de la policy `FOR ALL`/permissive plus large qui couvre la même commande — sinon la nouvelle policy est un theatre de sécurité, pas un contrôle réel. Il n'existe pas de `RESTRICTIVE` policy dans le schéma actuel ; ne pas en introduire ici (mélanger permissive/restrictive complique la lecture sans bénéfice, une policy par (table, commande) suffit et correspond déjà à la convention `bookings_insert_isolation` / `bookings_select_isolation` / `bookings_update_isolation`).

**Pattern à appliquer partout :** une policy par commande (`FOR SELECT`, `FOR INSERT`, `FOR UPDATE`, `FOR DELETE`), jamais `FOR ALL`, avec `USING` pour SELECT/UPDATE/DELETE et `WITH CHECK` pour INSERT/UPDATE. C'est déjà le style de `bookings_update_isolation` (qui a les deux) — mais `drivers_isolation`/`vehicles_isolation`/`pricing_isolation` (cherchés, `pricing_rules` n'apparaît même pas dans le grep de policies du baseline — à vérifier par le planner, la table pourrait n'avoir qu'une seule policy `_tenant_isolation` en `FOR ALL` sans le doublon `_isolation`) n'ont que `USING`, pas de `WITH CHECK` — ce qui, pour `FOR ALL`, fait retomber le `WITH CHECK` sur la clause `USING` (comportement Postgres documenté : si `WITH CHECK` est omis sur une policy qui couvre INSERT/UPDATE, `USING` sert aussi de `WITH CHECK`). C'est la cause directe du constat ROADMAP "`drivers_insert_owner_only` est sans effet... `drivers_isolation` (sans WITH CHECK, donc USING réutilisé) autorise déjà l'INSERT à tout membre".

### `current_tenant_role()` — modèle exact à répliquer

`current_tenant_id()` existant (`supabase/migrations/20260310000000_baseline.sql:252`) :
```sql
CREATE OR REPLACE FUNCTION "public"."current_tenant_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select tenant_id
  from public.profiles
  where id = auth.uid()
$$;
```
[VERIFIED: lecture directe de la migration]

Points notables pour le planner :
- **Pas `SECURITY DEFINER`** dans la version réelle, contrairement à ce que dit le libellé du requirement ROADMAP ("STABLE, SECURITY DEFINER, search_path figé"). La fonction actuelle est SQL `STABLE` simple, sans `SECURITY DEFINER`, et fonctionne car `profiles` a probablement une policy SELECT qui autorise un utilisateur à lire sa propre ligne (à vérifier par le planner/executor — si `current_tenant_role()` doit lire `tenant_role` sur `profiles` de la même façon, elle peut suivre le même modèle sans DEFINER). Le planner doit décider explicitement : suivre le libellé du ROADMAP (SECURITY DEFINER + search_path figé, plus robuste contre un search_path détourné, cohérent avec `security_checks.sql` règle 3) ou suivre le code réel existant (SQL STABLE simple). **Recommandation research : SECURITY DEFINER avec `search_path` figé**, car (a) le lint `security_checks.sql` règle 3 n'exige cela que pour les fonctions `prosecdef` — une fonction non-DEFINER n'est pas vérifiée par ce lint, donc suivre le modèle réel n'apporte pas de garantie CI ; (b) une fonction appelée dans chaque prédicat RLS bénéficie d'un chemin d'exécution non détournable. Mais comme `current_tenant_id()` (le modèle explicitement désigné par CONTEXT.md) n'est PAS SECURITY DEFINER, le planner doit trancher cette divergence avant d'écrire la migration — sujet à lever en clarification ou décision explicite dans le PLAN.
- `STABLE` (pas `IMMUTABLE`) est correct : le résultat peut changer entre transactions (changement de rôle en base) mais pas dans la même requête — nécessaire pour la performance en RLS (Postgres peut cacher le résultat par appel de requête plutôt que de le recalculer par ligne, cf. Pitfall 2).
- Fonction en langage `sql` (pas `plpgsql`) : plus simple, elle est "inlinable" par le planificateur de requêtes dans certains cas, ce qui aide à la performance RLS.

### Structure de la matrice (transcription CONTEXT.md → SQL)

Le planner devrait matérialiser la matrice D-01→D-11 dans le PLAN.md sous forme de tableau avant d'écrire les migrations (déjà demandé par le requirement ROADMAP R2), par exemple :

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `bookings` | tout le tenant | (hors périmètre direct client — via RPC ailleurs) | `driver`: `driver_id = auth.uid()` via profil ; `owner`/`manager`: tout le tenant | — |
| `drivers` | tout le tenant | owner/manager | owner/manager | owner/manager |
| `vehicles` | tout le tenant | owner/manager | owner/manager | owner/manager |
| `pricing_rules` | tout le tenant | owner/manager | owner/manager | owner/manager |
| `customers` | tout le tenant | tout le tenant | tout le tenant | tout le tenant |
| `financial_movements` | owner/manager seul | service_role (déjà fait Phase 12) | — (immuable) | — (immuable) |

Note : pour `bookings` UPDATE avec un rôle qui dépend de la ligne (driver limité à `driver_id`), le pattern est deux policies UPDATE distinctes plutôt qu'une seule avec OR interne, pour rester lisible et testable indépendamment — ou une seule avec `(current_tenant_role() IN ('owner','manager')) OR (current_tenant_role() = 'driver' AND driver_id = auth.uid())`. Les deux fonctionnent en Postgres (une seule policy UPDATE avec USING complexe, ou deux policies UPDATE qui s'OR-ent automatiquement) — c'est un choix de lisibilité laissé au planner (CONTEXT.md "détail syntaxique... au planner/executor").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Vérifier qu'aucune policy `FOR ALL` ne subsiste, qu'aucun doublon SELECT n'existe | Un script ad hoc à lancer manuellement | Étendre `supabase/lint/security_checks.sql` avec une nouvelle règle (5. policy `cmd = 'ALL'` sur les tables couvertes par la matrice, 6. plus d'une policy par (table, commande) hors overlaps documentés) | Le fichier existe déjà, tourne déjà en CI (`db-lint.yml`), suit déjà le format allowlist — cohérent avec le principe "sur le modèle de la validation locale de la Phase 11" cité dans le ROADMAP |
| Tester chaque rôle × opération | pgTAP (nouvelle dépendance, nouvelle extension à activer) | SQL brut avec `SET LOCAL ROLE authenticated;` + `SELECT set_config('request.jwt.claims', '{"sub":"<uuid>"}', true);` dans une transaction, assertions par `DO $$ ... RAISE EXCEPTION ... $$` sur le modèle de `security_checks.sql` | pgTAP n'est pas installé dans ce projet (aucune trace dans les migrations, aucune extension), l'ajouter est un nouveau outil pour un seul besoin ponctuel ; le patron `DO $$` existe déjà et est déjà exécuté en CI sans dépendance supplémentaire |

**Key insight:** ce projet a déjà résolu "comment tester du SQL en CI sans framework" avec `security_checks.sql` — Phase 13 doit étendre ce pattern, pas en introduire un nouveau.

## Common Pitfalls

### Pitfall 1: `SET ROLE` vs `SET request.jwt.claims` pour simuler un rôle en tests
**What goes wrong:** Un test SQL qui fait juste `SET ROLE authenticated;` sans poser `auth.uid()` échoue silencieusement ou lève une erreur de permission non liée au test (car `auth.uid()` dépend de `request.jwt.claims`, pas du rôle Postgres).
**Why it happens:** Supabase sépare le rôle Postgres (`anon`/`authenticated`/`service_role`, contrôle GRANT) du rôle applicatif (`auth.uid()`, extrait du JWT via `request.jwt.claims`, contrôle RLS). Les deux sont nécessaires : `SET ROLE authenticated` pour les GRANT de table, `set_config('request.jwt.claims', ..., true)` pour que `auth.uid()` retourne un utilisateur précis.
**How to avoid:** Chaque bloc de test doit faire les deux, dans cet ordre, à l'intérieur d'une transaction annulée (`BEGIN; ... ROLLBACK;`) pour ne pas laisser de données de test :
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '<uuid-driver>')::text, true);
-- assertions
ROLLBACK;
```
**Warning signs:** Un test qui "passe" pour tous les rôles sans jamais échouer (signe que `auth.uid()` est NULL et que les policies basées sur `current_tenant_id()`/`current_tenant_role()` retournent NULL, ce qui peut se comporter de façon inattendue selon l'opérateur utilisé).

### Pitfall 2: fonction RLS appelée par ligne — coût de performance si mal marquée
**What goes wrong:** Si `current_tenant_role()` est appelée dans une policy `USING`, Postgres peut l'exécuter une fois par ligne scannée si elle n'est pas reconnue comme "stable pour la durée de la requête" par le planificateur, surtout si elle est `VOLATILE` par erreur ou si elle contient un sous-select non trivial en `plpgsql`.
**Why it happens:** `STABLE` en SQL simple permet l'inlining/l'évaluation une fois par requête dans de nombreux cas ; `plpgsql` ou `VOLATILE` empêchent cette optimisation.
**How to avoid:** Garder `current_tenant_role()` en `LANGUAGE sql STABLE`, exactement comme `current_tenant_id()`, pas en `plpgsql`.
**Warning signs:** Requêtes sur `bookings`/`drivers` qui ralentissent notablement après l'ajout des nouvelles policies — à vérifier par `EXPLAIN ANALYZE` si soupçonné, mais pas un blocage pour cette phase (volumétrie du projet actuelle inconnue mais probablement faible, solo/quelques tenants).

### Pitfall 3: policies dupliquées à supprimer — liste incomplète en tête
**What goes wrong:** Le ROADMAP énumère "4 SELECT sur bookings, 2 FOR ALL sur drivers/vehicles/pricing_rules, 3 SELECT plateforme sur financial_movements" — mais la lecture directe du baseline montre des noms précis qu'il faut citer dans le PLAN pour ne pas en oublier un à l'exécution :
- `bookings` SELECT : `admin_full_view_platform_read`, `bookings_platform_admin_read`, `bookings_select`, `bookings_select_isolation` (4 confirmées — les deux `*_platform_admin_read`/`admin_full_view_platform_read` semblent être un doublon exact entre elles en plus, à vérifier par le planner).
- `bookings` UPDATE : une seule trouvée (`bookings_update_isolation`) — à réécrire avec le split driver/owner-manager (D-05/D-06), pas à dupliquer.
- `drivers` : `drivers_isolation` (FOR ALL, USING sur tenant_id via sous-select profiles) + `drivers_tenant_isolation` (FOR ALL, USING via `current_tenant_id()`) — deux policies `FOR ALL` équivalentes, plus `drivers_insert_owner_only` (INSERT, sans effet actuellement — Pitfall ci-dessus).
- `vehicles` : `vehicles_isolation` + `vehicles_tenant_isolation` — même doublon `FOR ALL` x2, à confirmer contenu exact par le planner (non lu en détail ici, positions données par grep : lignes 1739/1745 du baseline).
- `pricing_rules` : **non trouvé** de policy nommée `pricing_isolation`/`pricing_tenant_isolation` dans le baseline lors du grep — le ROADMAP les mentionne mais elles pourraient avoir été créées dans une migration ultérieure. **Le planner doit relancer `grep -n "pricing_rules" supabase/migrations/*.sql` et lire le contenu réel avant d'écrire la migration**, ne pas supposer la structure par analogie avec `vehicles`/`drivers`.
- `financial_movements` SELECT : `finance_select_isolated` (authenticated, tenant), `financial_platform_admin_read` (grep tronqué, à confirmer un 3e), plus celles ajoutées en Phase 12 (`platform_settings_select_super_admin` n'est pas sur cette table, à ne pas confondre) — le planner doit relire ces 3 policies en détail avant de les remplacer par la version owner/manager-only (D-09) tout en gardant l'accès `platform_role` super_admin/staff intact (hors périmètre rôle tenant mais à ne pas casser).
**How to avoid:** Le PLAN.md doit inclure, pour chaque table, la liste exacte des `DROP POLICY IF EXISTS` avant les `CREATE POLICY`, obtenue par une relecture fraîche (`\d+ <table>` en local ou grep migrations) au moment de l'exécution — pas recopiée de ce document sans revérification, car ce research n'a pas lu le contenu complet de `vehicles`/`pricing_rules`/`financial_movements` policy par policy.
**Warning signs:** Une migration qui ne `DROP`e pas une policy existante laisse l'ancien comportement permissif actif en parallèle du nouveau — silencieusement inefficace, comme le bug déjà documenté.

### Pitfall 4: `protect_booking_immutable_fields` à ne pas re-casser
**What goes wrong:** En réécrivant `bookings_update_isolation` pour séparer driver/owner-manager, un executor pourrait recréer une policy UPDATE qui autorise un sous-ensemble de colonnes différent de ce que le trigger `protect_booking_immutable_fields` (Phase 11) attend, ou désactiver le trigger par erreur.
**Why it happens:** RLS et triggers sont deux couches indépendantes ; réécrire l'une ne doit pas toucher l'autre, mais un `DROP TABLE`/`ALTER TABLE ... DISABLE TRIGGER ALL` accidentel en environnement de test local est un incident déjà connu du projet (cf. `apps/vtc-backoffice/CLAUDE.md`, section Incidents fréquents : "Règles métier silencieuses en local → triggers parfois désactivés en dev").
**How to avoid:** Le PLAN.md ne doit toucher qu'aux `CREATE POLICY`/`DROP POLICY`, jamais au trigger. Le test SQL par rôle doit vérifier explicitement qu'un `driver` qui modifie sa propre course ne peut toujours pas changer `total_amount`/`status` (test de non-régression sur Phase 11, pas seulement un nouveau test Phase 13).
**Warning signs:** Un test qui vérifie "driver peut UPDATE sa propre course" sans vérifier "driver ne peut PAS changer total_amount sur sa propre course" laisse un trou.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Aucun framework SQL dédié — SQL brut en `DO $$ ... $$`, exécuté via `psql`, sur le modèle de `supabase/lint/security_checks.sql` |
| Config file | `supabase/lint/security_checks.sql` (existant, à étendre) + nouveau fichier dédié recommandé, ex. `supabase/lint/rls_role_checks.sql` (séparé du lint de structure pour lisibilité — le lint actuel vérifie la forme des policies, pas leur effet ; ce nouveau fichier vérifie le comportement réel par rôle) |
| Quick run command | `psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/lint/rls_role_checks.sql` (local, après `supabase db reset --no-seed` + seed de données de test minimal : 1 tenant, 1 owner, 1 manager, 2 drivers) |
| Full suite command | Identique — pas de distinction quick/full nécessaire pour ce volume |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R3/D-07/D-08 | `drivers` : owner/manager écrivent, driver ne peut ni INSERT ni UPDATE ni DELETE | sql-role-assert | `psql -f supabase/lint/rls_role_checks.sql` | ❌ Wave 0 |
| D-11 | `vehicles`/`pricing_rules` : SELECT ouvert à tout rôle, UPDATE/INSERT/DELETE refusé à driver | sql-role-assert | idem | ❌ Wave 0 |
| D-05/D-06 | `bookings` UPDATE : driver limité à `driver_id`, owner/manager large y compris réassignation | sql-role-assert | idem | ❌ Wave 0 |
| D-09 | `financial_movements` SELECT : driver 0 ligne, owner/manager toutes les lignes du tenant | sql-role-assert | idem | ❌ Wave 0 |
| D-03/D-04 | `bookings` SELECT : tous rôles voient toutes les courses du tenant, aucune fuite cross-tenant | sql-role-assert | idem | ❌ Wave 0 |
| Non-régression Phase 11 | `protect_booking_immutable_fields` toujours actif après réécriture des policies UPDATE | sql-role-assert | idem | ❌ Wave 0 (mais logique déjà existante, juste rejouée) |
| R3 (lint structurel) | Aucune policy `FOR ALL` restante sur les tables couvertes ; pas plus d'une policy par (table, commande) | sql-lint | `psql -f supabase/lint/security_checks.sql` (étendu) | ❌ Wave 0 (nouvelle règle à ajouter dans le fichier existant) |

### Sampling Rate
- **Per task commit:** exécution locale manuelle de `rls_role_checks.sql` après chaque migration touchant une table de la matrice
- **Per wave merge:** `supabase db reset --no-seed` complet + les deux fichiers de lint, comme le fait déjà `db-lint.yml`
- **Phase gate:** CI verte (nouveau job ou step ajouté à `schema-security` dans `.github/workflows/db-lint.yml`) avant `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `supabase/lint/rls_role_checks.sql` — nouveau fichier, assertions par rôle × table × opération (voir tableau ci-dessus)
- [ ] Extension de `supabase/lint/security_checks.sql` — nouvelle règle détectant les policies `cmd = 'ALL'` restantes sur les tables couvertes par la matrice Phase 13, et les doublons (plus d'une policy active par table+commande, hors cas légitimes comme le split driver/owner-manager sur `bookings` UPDATE qui reste **une** policy avec condition composée ou **deux** policies volontairement redondantes par rôle — le lint doit savoir distinguer "doublon accidentel" de "split par rôle volontaire", donc probablement une allowlist plutôt qu'une interdiction totale de policies multiples)
- [ ] Fixtures de test minimales : seed SQL (pas via `supabase/seed.sql` de prod) créant 1 tenant + profils owner/manager/driver×2 avec UUID fixes, réutilisable dans une transaction `ROLLBACK`
- [ ] Étape CI : ajouter le nouveau fichier de lint comme step supplémentaire dans le job `schema-security` de `db-lint.yml` (même pattern que le step "Schema security lint" existant, ligne 34-38)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | RLS policy per (table, command), pas de `FOR ALL`, `current_tenant_role()` comme source unique de vérité rôle |
| V1 Architecture | yes | Principe déjà acté par ADR-011 : "la sécurité descend en base avant que le client ne change" — RLS = seule barrière réelle pour les écritures directes Supabase (`vehicles.astro`, `pricing.astro`) |
| V5 Input Validation | non applicable directement | Pas de nouvelle saisie utilisateur dans cette phase |
| V6 Cryptography | non applicable | — |

### Known Threat Patterns for ce stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Policy permissive `FOR ALL` masquant une policy restrictive plus étroite (déjà exploité en interne, constat 2026-09-27) | Elevation of Privilege | Une policy par (table, commande), suppression systématique des `FOR ALL`/doublons avant ajout d'une policy plus étroite |
| Appel PostgREST direct contournant une route API qui n'existe pas (`vehicles.astro`/`pricing.astro`/gestion drivers) | Tampering | RLS = seul rempart, pas de dépendance à `ROUTE_POLICY` (middleware) pour ces écritures |
| `auth.jwt()` / `auth.uid()` NULL en session sans JWT (migration, console SQL) traité différemment des sessions authentifiées | Elevation of Privilege / Denial of Service | Suivre le pattern déjà en place dans `auto_create_financial_movement` (`coalesce(auth.jwt() ->> 'role', 'service_role')`) si `current_tenant_role()` doit gérer ce cas — à vérifier si nécessaire pour Phase 13 (les policies s'appliquent-elles pendant `supabase db reset`/migrations en tant que superuser, qui bypass RLS de toute façon — normalement non-impactant) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `current_tenant_role()` devrait être SECURITY DEFINER malgré le fait que `current_tenant_id()` (le modèle désigné) ne l'est pas | Architecture Patterns | Divergence de style dans le schéma ; si le planner suit le modèle réel (non-DEFINER) à la place, aucun risque de sécurité identifié tant que `profiles` a une policy SELECT correcte pour lire sa propre ligne — à vérifier par le planner |
| A2 | Contenu exact des policies `vehicles_isolation`/`vehicles_tenant_isolation`/`pricing_rules_*`/`financial_platform_admin_read` (non lues caractère par caractère, seulement grep de position) | Common Pitfalls, Pitfall 3 | Le planner pourrait omettre un `DROP POLICY` si le nom réel diffère de ce qui est supposé ici par analogie |
| A3 | `pricing_rules` a des policies nommées comme le dit le ROADMAP (`pricing_isolation`, `pricing_tenant_isolation`) — non confirmé par grep direct dans cette recherche | Pitfall 3 | Risque de migration `DROP POLICY IF EXISTS` sur un nom qui n'existe pas (inoffensif, `IF EXISTS` protège) mais aussi de ne pas dropper la vraie policy si son nom diffère |
| A4 | `cancellation_policies`/`zones`/`fixed_routes` n'ont aucune policy `_isolation` actuellement (déduit d'un grep qui ne les a pas fait remonter) | User Constraints, Claude's Discretion | Si elles ont en réalité une policy tenant existante sous un autre nom, le planner risque de créer un doublon plutôt que de constater l'absence de policy |

## Open Questions

1. **SECURITY DEFINER ou non pour `current_tenant_role()` ?**
   - What we know: le ROADMAP demande SECURITY DEFINER + search_path figé ; le code réel de `current_tenant_id()` (modèle désigné par CONTEXT.md) est SQL STABLE simple, sans DEFINER.
   - What's unclear: pourquoi la divergence existe (peut-être une intention non appliquée, peut-être un choix délibéré non documenté).
   - Recommendation: trancher explicitement dans le PLAN.md, pas dans le code sans le dire — si SECURITY DEFINER est choisi, documenter pourquoi ça diffère du modèle ; si le modèle réel est suivi, noter que le libellé du ROADMAP requirement est imprécis.

2. **Doublons exacts sur `vehicles`, `pricing_rules`, `financial_movements`**
   - What we know: leur existence et le nombre approximatif (ROADMAP), positions de ligne pour `vehicles` dans le baseline.
   - What's unclear: contenu SQL exact, si des migrations ultérieures au baseline les ont déjà modifiées.
   - Recommendation: le planner (ou l'executor en tâche 1) doit relire ces policies avec `\d+ vehicles` / `\d+ pricing_rules` / `\d+ financial_movements` sur une base locale reset, avant d'écrire les `DROP POLICY`.

## Sources

### Primary (HIGH confidence)
- Lecture directe : `supabase/migrations/20260310000000_baseline.sql` (policies `bookings`, `customers`, `drivers`, `financial_movements`, `current_tenant_id()`)
- Lecture directe : `supabase/migrations/20260927023037_close_anon_write_paths.sql` (pattern de fermeture d'accès, style de migration)
- Lecture directe : `supabase/lint/security_checks.sql` (pattern de test SQL en CI existant)
- Lecture directe : `.github/workflows/db-lint.yml` (pipeline CI existant)
- Lecture directe : `apps/vtc-backoffice/src/lib/guards.ts` (`ROUTE_POLICY`, source de vérité des droits)
- Lecture directe : `.planning/phases/13-r-les-tenant-dans-la-rls/13-CONTEXT.md` (décisions verrouillées)
- Lecture directe : `.planning/ROADMAP.md` sections Phase 11, 12, 13

### Secondary (MEDIUM confidence)
- Connaissance de formation sur le comportement RLS Postgres (policies permissives = OR, `WITH CHECK` omis retombe sur `USING`) — cohérent avec le comportement observé et documenté dans le ROADMAP lui-même, donc considéré comme confirmé par preuve interne au projet plutôt que par recherche web externe cette session.

### Tertiary (LOW confidence)
- Aucune recherche web externe effectuée cette session (Context7/WebSearch non utilisés) — le domaine RLS Postgres est suffisamment couvert par les preuves internes au repo (bug déjà diagnostiqué et documenté par l'équipe elle-même) ; recommandé si le planner veut confirmer le comportement `RESTRICTIVE` vs `PERMISSIVE` sur la doc Postgres officielle avant de rédiger le PLAN, mais non bloquant.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — pas de nouvelle librairie, uniquement SQL/RLS natif Postgres
- Architecture: HIGH — patterns et bug root-cause vérifiés par lecture directe du code et des migrations
- Pitfalls: HIGH pour les pitfalls 1/2 (connaissance Postgres/Supabase standard), MEDIUM pour pitfall 3 (liste de doublons partiellement non vérifiée caractère par caractère — voir Assumptions Log A2/A3)

**Research date:** 2026-09-29
**Valid until:** stable tant que le schéma n'est pas modifié par une autre phase en parallèle — revérifier les policies exactes juste avant l'exécution (Pitfall 3)
