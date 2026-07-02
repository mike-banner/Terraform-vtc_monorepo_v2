# ADR-001 : Split en 3 apps + centralisation Supabase à la racine

- **Date** : 2026-06-29
- **Statut** : Accepté et implémenté
- **Commits** : `3e5bf53` (import architecture Terraform pour 3 apps Pages), `ce2e9c8` (déplacement de `supabase/` vers la racine)

## Contexte

Le projet existait en plusieurs dépôts séparés (`vtc_mvp` pour le backoffice tenant, `vtc-drivers` pour le site vitrine chauffeur). Chaque dépôt avait sa propre copie de `supabase/` (migrations, types), créant un risque de divergence de schéma et doublant le travail de maintenance/déploiement.

## Décision

- Fusion dans un monorepo unique `vtc_repo_v2` (pnpm workspaces + Turborepo) avec trois apps indépendantes : `apps/backoffice`, `apps/drivers-front`, `apps/superadmin`.
- `supabase/` (migrations, Edge Functions, config) déplacé à la racine — source de schéma unique partagée par les trois apps.
- `packages/database` partagé pour le client Supabase SSR et les types générés (`database.types.ts`), évitant la duplication de types entre apps.
- Déploiement Cloudflare Pages distinct par app, piloté par Terraform (un projet Pages par app, cf. `terraform/pages.tf`).

## Conséquences

- Un seul `supabase db push` / `gen:types` fait foi pour tout le monorepo — toute app qui dépend du schéma doit régénérer ses types après une migration.
- Les trois apps restent déployées indépendamment (changement dans `apps/backoffice` ne redéploie pas `drivers-front`).
- Les ADR historiques des anciens dépôts (`vtc_mvp`, `vtc-drivers`) ont été rapatriées dans `docs/decisions/backoffice/` et `docs/decisions/drivers-front/` — toujours valables, les décisions qu'elles documentent sont implémentées dans le schéma/code actuel.
