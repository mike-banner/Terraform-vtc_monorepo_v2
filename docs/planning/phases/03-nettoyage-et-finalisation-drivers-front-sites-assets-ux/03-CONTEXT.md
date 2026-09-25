# Phase 03: Nettoyage et Finalisation Drivers Front - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning
**Source:** User discussion & roadmap

<domain>
## Phase Boundary
Finalisation de l'application `apps/drivers-front` (Astro/React/Tailwind) pour son déploiement en production. Cela inclut le nettoyage du code mort, la gestion optimisée des assets (images lourdes), et les retouches UX finales pour les sites locataires (ex: Elite Lyon).
</domain>

<decisions>
## Implementation Decisions

### 1. Gestion des Assets Lourd
- Conserver le gitignore actuel pour les images volumineuses dans `apps/drivers-front/src/sites/elite-lyon/assets` tant que la connexion réseau limite les pushs Github.
- Implémenter le lazy-loading natif ou via composants Astro (`<Image />`) pour toutes les images.

### 2. Nettoyage du Code et UX
- Vérifier les balises `<meta>` SEO pour le front-office.
- S'assurer que le routing et la liaison avec le middleware backoffice/Supabase n'interfèrent pas avec le chargement public des landing pages.
</decisions>

<canonical_refs>
## Canonical References
- `apps/drivers-front/package.json`
- Stratégie d'isolation réseau discutée en Session 1 (conservation `.gitignore` restrictif).
</canonical_refs>
