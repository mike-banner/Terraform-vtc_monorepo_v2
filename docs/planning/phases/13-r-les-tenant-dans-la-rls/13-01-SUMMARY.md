---
phase: 13-r-les-tenant-dans-la-rls
plan: 01
subsystem: database
tags: [postgres, rls, supabase, policies]

requires: []
provides:
  - "Inventaire des policies RLS (31 lignes, 10 tables) confirmé identique au baseline figé le 2026-09-29"
  - "Fonction public.current_tenant_role() : SQL STABLE, search_path figé, sans SECURITY DEFINER"
  - "Matrice rôle × table × opération (R2) validée en tête de plan, à recopier dans la migration de policies du plan 02"
affects: [13-02, 13-03]

tech-stack:
  added: []
  patterns:
    - "current_tenant_role() calque exact de current_tenant_id() : pas de SECURITY DEFINER, filtré par auth.uid()"

key-files:
  created:
    - supabase/migrations/20260929100000_current_tenant_role.sql
  modified:
    - packages/database/src/database.types.ts

key-decisions:
  - "current_tenant_role() sans SECURITY DEFINER (Q1 tranchée en amont du plan, cf. décision Q1-security-definer)"
  - "Types régénérés puis reset au commit précédent + ajout manuel de la seule ligne current_tenant_role (le gen complet introduisait 34 lignes de dérive sans rapport, dont un changement de schéma __InternalSupabase et site_slug)"

patterns-established:
  - "Baseline de policies figé avant migration : toute divergence stoppe l'exécution avant d'écrire un DROP POLICY par nom"

requirements-completed: [P13-R1, P13-R2]

duration: 15min
completed: 2026-09-29
---

# Phase 13 Plan 01: Socle RLS tenant — current_tenant_role() Summary

**Fonction `current_tenant_role()` posée (STABLE, non-DEFINER, calque de current_tenant_id) après confirmation stricte que l'inventaire local de 31 policies sur 10 tables correspond au baseline figé, socle pour les migrations de policies des plans 02/03.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2/2 completed
- **Files modified:** 2 (1 créé, 1 modifié)

## Accomplishments

- Base locale reconstruite via `supabase db reset --no-seed` (identique à la commande CI), données locales sauvegardées avant reset dans le scratchpad de session
- Inventaire `pg_policies` sur les 10 tables de la phase confirmé identique ligne à ligne au baseline `<baseline id="policies-2026-09-29">` du plan (31/31, dont les 4 policies nommées de contrôle)
- `public.current_tenant_role()` créée : LANGUAGE sql, STABLE, `SET search_path TO 'public'`, sans SECURITY DEFINER — vérifiée `prosecdef=f`, `provolatile=s`, `proconfig={search_path=public}`
- Test fonctionnel sous rôle `anon` : renvoie NULL sans erreur de permission
- `security_checks.sql` passe (« Schema security lint passed »)
- Types régénérés (ligne `current_tenant_role` ajoutée dans `Functions`)

## Task Commits

1. **Task 1: Reconstruire la base locale et vérifier l'inventaire de policies** — aucun commit (aucun fichier du repo modifié ; sauvegarde dans le scratchpad de session uniquement)
2. **Task 2: Migration current_tenant_role() et régénération des types** - `6ed7fe5` (feat)

## Files Created/Modified

- `supabase/migrations/20260929100000_current_tenant_role.sql` - fonction `current_tenant_role()`, contenu exact du plan
- `packages/database/src/database.types.ts` - ajout de la ligne `current_tenant_role: { Args: never; Returns: Database["public"]["Enums"]["tenant_role"] }` dans `Functions`

## Decisions Made

- `current_tenant_role()` sans SECURITY DEFINER (décision Q1 du plan, déjà tranchée avant exécution)
- Régénération des types : le `supabase gen types` complet a introduit 34 lignes de dérive sans rapport avec cette migration (retrait du bloc `__InternalSupabase`/`PostgrestVersion`, ajout de `site_slug`, réécriture de types génériques `Tables<>`/`Enums<>` par une version plus récente du générateur). Conformément à l'instruction du plan en cas de dérive : `git checkout` du fichier puis ajout manuel de la seule ligne `current_tenant_role` juste après `current_tenant_id`.

## Deviations from Plan

None — plan exécuté exactement comme écrit, y compris le chemin de repli documenté par le plan lui-même pour la régénération des types (dérive anticipée, traitée selon l'instruction fournie).

## Issues Encountered

- `pg_dump` du système (16.14) incompatible avec le serveur Postgres local (17.6, image Supabase). Contournement : `pg_dump` exécuté à l'intérieur du conteneur `supabase_db_vtc_repo_v2` (version serveur correspondante). Sauvegarde produite : `local-before-phase13.sql` dans le scratchpad de session (`/tmp/claude-1000/-home-mike-projects-vtc-vtc-repo-v2/80743076-cded-424a-b2d3-889a49e475a9/scratchpad/local-before-phase13.sql`), 21534 octets.

## User Setup Required

None - aucune configuration de service externe requise.

## Next Phase Readiness

- Plan 02 peut écrire les `DROP POLICY` nommés en confiance : l'inventaire de 31 policies est confirmé exact, pas deviné par analogie
- La matrice rôle × table × opération (section `<matrix>` de ce plan) est prête à être recopiée en tête de la migration de policies du plan 02
- `current_tenant_role()` disponible pour les nouvelles policies par rôle des plans 02/03

---
*Phase: 13-r-les-tenant-dans-la-rls*
*Completed: 2026-09-29*

## Self-Check: PASSED
