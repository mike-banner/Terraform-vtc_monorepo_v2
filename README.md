# VTC Platform

Une plateforme de mise en relation VTC moderne, structurée autour d'une architecture monorepo haute performance.

## Architecture & Technologies

Ce projet utilise un **Monorepo Turborepo** pour partager la logique métier entre les différentes applications tout en garantissant un build incrémental rapide.

*   **Gestionnaire de paquets :** pnpm (Workspaces)
*   **Applications Front/Back :** Astro.js, React (SSR/SSG hybride)
*   **Base de Données & Auth :** Supabase (PostgreSQL, Realtime, RLS)
*   **UI/UX :** Ark UI, TailwindCSS
*   **Déploiement :** Cloudflare (Edge Computing)

## Structure du Monorepo

```text
.
├── apps/
│   ├── backoffice/       # Dashboard d'administration (Astro/React)
│   └── drivers-front/    # Application chauffeurs (Astro/React)
├── packages/
│   └── database/         # Typages générés et clients Supabase mutualisés
├── turbo.json            # Configuration du pipeline de build
└── pnpm-workspace.yaml   # Déclaration du monorepo
```

## Décisions Techniques (ADR)

1.  **Isolation de la couche de données :** Le package `@vtc/database` centralise les types générés et l'instanciation des clients Supabase. Cela empêche la duplication de code et garantit la cohérence des requêtes sur toute la stack.
2.  **Gestion de l'environnement SSR :** Implémentation d'un polyfill `ws` au niveau du package base de données pour assurer la stabilité du `RealtimeClient` Supabase dans les environnements Node.js >= 20.
3.  **Edge Rendering :** L'utilisation d'Astro avec le déploiement sur Cloudflare permet une distribution au plus près des utilisateurs avec des temps de réponse minimaux.

## Scripts Utiles

```bash
# Installation des dépendances
pnpm install

# Démarrer l'environnement de développement (toutes les applications)
pnpm dev

# Compiler pour la production
pnpm build
```
