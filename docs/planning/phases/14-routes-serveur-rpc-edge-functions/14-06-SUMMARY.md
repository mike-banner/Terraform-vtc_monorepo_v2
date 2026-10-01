---
phase: 14-routes-serveur-rpc-edge-functions
plan: 06
subsystem: database
tags: [supabase, rpc, tenants, onboarding, lint]
requires: [14-01, 14-02, 14-05]
provides:
  - public.update_tenant_logo(text) RETURNS text
  - public.update_tenant_settings(text, text) RETURNS void
  - public.complete_tenant_setup(jsonb, jsonb, jsonb) RETURNS void
  - supabase/lint/rpc_tenant_checks.sql
key-files:
  created:
    - supabase/migrations/20260929110600_rpc_tenant_logo_settings.sql
    - supabase/migrations/20260929110610_rpc_complete_tenant_setup.sql
    - supabase/lint/rpc_tenant_checks.sql
decisions:
  - Logo : regex stricte conservée, aucune migration de données (voir ci-dessous)
metrics:
  tasks: 2
  completed: 2026-10-01
requirements: [P14-R1]
---

# Phase 14 Plan 06 : RPC owner sur tenants

Trois RPC réservées à l'owner remplacent les écritures `service_role` sur `tenants` : logo, forme juridique / TVA,
onboarding. La TVA n'est jamais écrite par les RPC : `trg_sync_tenant_vat` la dérive. L'onboarding écrit une
liste explicite de colonnes (mass assignment fermé), exige `setup_completed = false` et est atomique.

## Commits
- 1e66ede test(db): matrice RPC logo et paramètres tenant (suite complète, RED : fonctions absentes)
- d3addc8 feat(db): RPC owner pour le logo et la forme juridique du tenant
- 204f3b2 feat(db): RPC complete_tenant_setup transactionnelle, colonnes explicites

## Vérifications
`supabase db reset --no-seed` puis `security_checks`, `rls_role_checks` et les cinq `rpc_*_checks` : code 0.
Critères grep : 0 `vat_rate` / `is_vat_exempt` hors commentaires, 2 `IS DISTINCT FROM 'owner'` dans la migration logo/paramètres.
Aucune trace d'IA dans les messages de commit.

## Logo existant non conforme (relevé 14-01, point 4)
Relevé prod : 2 logos, 1 conforme au motif `assets/logos/<tenant_id>/<fichier>`, 1 non conforme.
Choix : la regex reste stricte (menace T-14-28, phishing) et on ne migre aucune donnée. Justification :
- la regex n'est évaluée que dans `update_tenant_logo`, à l'écriture ; la migration ne lit ni ne réécrit
  `tenants.logo_url`, donc le logo non conforme reste en base et continue de s'afficher ;
- le prochain upload via `settings.astro` produit toujours `logos/<tenant_id>/logo.<ext>` (conforme), l'owner concerné
  n'est donc pas bloqué ;
- migrer la donnée supposerait de déplacer un objet de storage en prod, interdit ici et sans bénéfice.
Limite : je n'ai pas pu relire l'URL exacte non conforme (pas d'accès prod depuis cet agent). Si elle doit rester
re-sélectionnable telle quelle par l'API, il faudra assouplir la regex : à voir avec l'utilisateur.

## Deviations from Plan
- Le commit RED contient d'emblée toutes les assertions des tâches 1 et 2 (un seul fichier de suite), au lieu de deux
  commits de test séparés.
- Test : `capital_social` est `numeric(x,2)`, l'attendu est `1000.00`.
Sinon : plan exécuté tel qu'écrit.

## Bug existant hors périmètre
Le `<select name="category">` de `apps/vtc-backoffice/src/pages/app/setup.astro` propose `business` et `first`, absents de
`vehicle_category_enum` (`berline, van, suv, minibus, luxury`). La RPC les refuse (22023, 'Catégorie de véhicule
invalide', testé). La page doit être alignée sur l'enum lors de la bascule du POST (D-12).

## À confirmer par l'utilisateur
A-CONFIRMER-TARIF: décision produit, défaut retenu, à confirmer — price_per_minute du formulaire d'onboarding converti en price_per_hour = round(x * 60, 2) ; 0,5 €/min (30 €/h) si le champ est vide.

## Known Stubs
Aucun.

## Self-Check: PASSED
