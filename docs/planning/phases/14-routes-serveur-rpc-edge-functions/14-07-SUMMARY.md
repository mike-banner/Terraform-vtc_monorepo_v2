---
phase: 14-routes-serveur-rpc-edge-functions
plan: 07
subsystem: database
tags: [supabase, rpc, rating, vtc-websites, anon]
requires: [14-02, 14-03, 14-04, 14-05, 14-06]
provides:
  - public.get_rating_context(uuid) RETURNS TABLE(tenant_name, logo_url, google_reviews_url, already_rated)
  - public.submit_rating(uuid, integer, text) RETURNS void
  - vtc-websites /rate/[id] et /api/submit-rating
  - types des 9 RPC de la phase dans database.types.ts
key-files:
  created:
    - supabase/migrations/20260929110700_rpc_public_rating.sql
    - supabase/lint/rpc_rating_checks.sql
    - apps/vtc-websites/src/pages/rate/[id].astro
    - apps/vtc-websites/src/pages/api/submit-rating.ts
  modified:
    - packages/database/src/database.types.ts
    - .github/workflows/deploy.yml
    - apps/vtc-websites/CLAUDE.md
metrics:
  tasks: 3
  completed: 2026-10-01
requirements: [P14-R4]
---

# Phase 14 Plan 07 : notation publique via RPC anon

La notation passe sur vtc-websites en clé anon : deux RPC minimales, une page autonome en tokens sémantiques, un proxy
`/api/submit-rating`. Le lien du QR du backoffice pointe vers websites via `PUBLIC_SITE_URL` injecté au build.

## Commits
- test(db): matrice notation publique anon (RED : fonctions absentes)
- feat(db): RPC publiques de notation, get_rating_context et submit_rating
- feat(websites): page et route de notation publique via RPC anon (inclut les types)
- docs(websites): notation publique, seule écriture autorisée ; lien du QR au build

## Vérifications
- `supabase db reset --no-seed` puis security_checks, rls_role_checks et les 6 `rpc_*_checks` : aucune erreur.
- Fonctions SECURITY DEFINER exécutables par anon = 5 (allowlist règle 9).
- `database.types.ts` : +66 lignes, 0 supprimée, 9 entrées attendues présentes (insérées depuis `gen types --local`).
- `tsc --noEmit` et `build` websites : OK. Aucune couleur codée en dur dans la page, 2 `<h1>` (branches exclusives).
- Aucun trailer ni mention d'IA dans les commits ; `RatingQRModal.tsx` et `scripts/bookings.ts` intouchés.

## Deviations from Plan
Aucune sur le fond. Détail : le parseur d'insertion des types gère les entrées `Functions` sur une ligne (`update_tenant_logo`).

## Points d'attention
- URL du QR : défaut `https://vtc-drivers-front-<env>.pages.dev` (Q5 ouverte : `https://{primary_domain}` du tenant possible).
- Rate-limit/captcha toujours différés (T-14-36 accepté).
- La page n'est pas testée visuellement (contrôle manuel prévu au plan 11).
- `STATE.md` / `ROADMAP.md` non mis à jour (`.planning` est un symlink Vault).

## Self-Check: PASSED
