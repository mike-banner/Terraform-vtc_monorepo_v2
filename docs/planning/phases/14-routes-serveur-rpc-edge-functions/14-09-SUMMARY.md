---
phase: 14-routes-serveur-rpc-edge-functions
plan: 09
status: complete
subsystem: backoffice
tags: [astro, rpc, proxy, ci, service_role]
requires: [14-06, 14-07, 14-08]
provides:
  - update-logo, update-settings, setup.astro (POST) en proxys RPC owner (session utilisateur)
  - garde-fou CI D-13 (step « Refuser le client admin dans le backoffice »)
key-files:
  modified:
    - apps/vtc-backoffice/src/pages/api/tenant/update-logo.ts
    - apps/vtc-backoffice/src/pages/api/tenant/update-settings.ts
    - apps/vtc-backoffice/src/pages/app/setup.astro
    - apps/vtc-backoffice/CLAUDE.md
    - .github/workflows/deploy.yml
    - docs/planning/ROADMAP.md
  deleted:
    - apps/vtc-backoffice/src/pages/rate/[id].astro
    - apps/vtc-backoffice/src/pages/api/submit-rating.ts
    - apps/vtc-backoffice/src/lib/supabase/server.ts
  moved:
    - apps/vtc-backoffice/test/scripts -> scripts/debug-backoffice (9 scripts + README)
metrics:
  tasks: 3
  completed: 2026-10-01
requirements: [P14-R1, P14-R5, P14-R6]
---

# Phase 14 Plan 09 : fin du service_role dans le backoffice

Le backoffice n'a plus de client admin : les écritures tenant et l'onboarding passent par `update_tenant_logo`,
`update_tenant_settings` et `complete_tenant_setup` avec la session. La page publique de notation (déjà servie par
vtc-websites) et `lib/supabase/server.ts` sont supprimés, les scripts de debug sortent de l'app, la CI interdit le retour.

## Commits
- 03abe7c refactor(backoffice): paramètres tenant et onboarding via RPC owner
- f16ff92 chore(backoffice): retire le client admin, la page publique de notation et garde-fou CI
- 5a03b98 docs(14): règles backoffice sans service_role, ROADMAP à jour

## Vérifications
`tsc --noEmit`, `build` backoffice, `check-route-policy.mjs` (16 chemins, aucun écart) : verts. `git grep` D-13 : vide.
Contre-épreuve : `// createAdminClient` ajouté dans `rpc-error.ts` -> trouvé par le grep, puis `git checkout --`.
9 scripts dans `scripts/debug-backoffice/`. Aucune mention interdite dans les commits.

## Écarts
- **Écart technique à D-12** : `setup.astro` modifié au-delà du POST (déstructuration `supabase: supabaseAdmin` renommée
  en `supabase`, lecture du tenant adaptée), sans changement de comportement (le client était déjà celui de session).
- `docs/planning/ROADMAP.md` : la copie par `cp` a aussi repris d'autres lignes du `.planning/ROADMAP.md` (docs était en retard).
- `STATE.md` / ROADMAP via gsd-tools non mis à jour (`.planning` est un symlink Vault).
- `pnpm lint` global non rejoué ici.

## Points ouverts
- **Bug existant non corrigé (plan : HTML intact)** : `setup.astro` propose encore `business` et `first`, absents de
  `vehicle_category_enum`. La RPC les refuse (400, « Catégorie de véhicule invalide ») : un owner qui les choisit
  échouera à l'onboarding. À aligner sur `berline, van, suv, minibus, luxury` (hors périmètre du plan, à décider).
- `setup.astro` l.477 envoie encore `is_vat_exempt` dans `legal` : à vérifier que `complete_tenant_setup` l'ignore
  (colonnes explicites, TVA dérivée par trigger) lors du contrôle fonctionnel du plan 11.
- `SECURITY_REVIEW.md` cite toujours `createAdminClient` (hors grep, `*.md`).

## Known Stubs
Aucun.

## Self-Check: PASSED
