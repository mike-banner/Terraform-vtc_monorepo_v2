---
phase: 13-r-les-tenant-dans-la-rls
plan: 04
subsystem: database
tags: [postgres, rls, supabase, production, deploy]

requires: ["13-01", "13-02", "13-03"]
provides:
  - "3 migrations 20260929100000..100200 appliquées en production, plus 20260929100300 (réactivation de 3 triggers bookings)"
  - "database.types.ts régénéré depuis la production"
affects: [14]

key-decisions:
  - "Contrôles après push rejoués le 2026-09-29 en lecture seule (voir Vérification), le plan ayant été exécuté sans SUMMARY"

requirements-completed: [P13-R1, P13-R2, P13-R3, P13-R4, P13-R5]

completed: 2026-09-29
---

# Phase 13 Plan 04: Mise en production Summary

Exécution : `supabase db push --linked` (3 migrations), puis correctif `20260929100300_reenable_bookings_triggers.sql`
(commit `83040b1`), ROADMAP mis à jour (`68c156c`, `a44824c`), déploiement mergé (`b6b6b07`).

## Trace du GO

Le « GO » exigé par la Task 2 a été donné en session ; sa citation littérale n'a pas été conservée dans les
artefacts. Seule trace : le merge `b6b6b07` (`deploy/phase-13-rls-prod`) et le statut du ROADMAP.

## Vérification (rejouée le 2026-09-29, lecture seule, projet `kpnkhmtxzigxtfnkmzru`)

| Contrôle | Résultat |
|----------|----------|
| `list_migrations` | les 4 versions `20260929100000/100100/100200/100300` appliquées, aucune version sans fichier local |
| Policies des 6 tables, prod vs base locale | 23 lignes chacune, empreinte md5 identique (`b7eead0b…`) sur nom, rôles, commande, USING, WITH CHECK |
| `has_column_privilege('authenticated', bookings.total_amount, UPDATE)` | `false` |
| `has_column_privilege('authenticated', bookings.driver_id, UPDATE)` | `true` |
| `trg_drivers_self_update_guard` | actif (`O`) |
| `current_tenant_role()` | `prosecdef = false` |
| `security_checks.sql` (règles 1 à 6, joué en `DO $$` sur la prod) | 0 violation |
| `get_advisors` security | 0 ERROR ; 1 INFO (`cancellation_policies` sans policy) ; 10 WARN, tous sur des objets antérieurs à la phase (fonctions SECURITY DEFINER exécutables : `get_available_vehicles`, `get_public_booking_result`, `get_public_tenant`, `approve_onboarding_tx`, `delete_tenant_account`, `get_fiscal_summary` ; protection mots de passe compromis désactivée). `current_tenant_role` n'y figure pas |

Limite : le relevé « avant push » (`prod-advisors-before.txt`) n'existe plus, la comparaison avant/après n'est donc
pas rejouable. La conclusion « aucun nouveau lint » repose sur l'origine des objets listés, pas sur un diff.

## Écart résiduel découvert pendant cette vérification

Trois autres triggers de `bookings` sont encore **désactivés en production** (`tgenabled='D'`) alors qu'ils sont
actifs (`O`) en local :

- `trg_prevent_late_cancellation`
- `trg_prevent_pickup_time_change_after_paid`
- `trg_prevent_policy_update`

La migration `20260929100300` n'en a réactivé que trois autres (`trg_protect_booking_fields`,
`trg_prevent_booking_delete`, `trg_validate_booking_status_transition`). Aucune migration du repo ne désactive
ces triggers : même dérive, même cause inconnue. Non corrigé ici (nouvelle migration = décision utilisateur).
Impact potentiel : annulation tardive, changement d'heure de prise en charge après paiement et modification de
politique d'annulation non gardés côté base.

## Déviations

- Migration supplémentaire `20260929100300` (dérive de triggers), hors plan initial.
- Écart ci-dessus non traité.
