# Phase 03: Nettoyage et Finalisation Drivers Front - Plan

**Status:** Complete
**Context:** [03-CONTEXT.md](03-CONTEXT.md)

<threat_model>
- **Assets modified:** Frontend UI logic (`apps/drivers-front/`), configuration des assets, et métadonnées SEO.
- **Risks:** Risque SEO (mauvaises balises indexées) et risque de performances (images non optimisées).
- **Mitigation:** Utiliser systématiquement l'optimisation d'image intégrée au framework, valider la structure des pages avec Lighthouse.
</threat_model>

<plan>
## Step 1: Optimisation des Assets (Images)
- [x] Mettre à jour les imports d'images dans les composants Astro pour utiliser `<Image />` ou `<Picture />`.
- [x] Vérifier que le build ignore les fichiers lourds exclus par le `.gitignore`.
- **Verification:** Les images sont servies en format moderne (WebP/AVIF) avec attributs `loading="lazy"`.

## Step 2: Optimisation SEO (Balises)
- [x] Implémenter un composant central `<Seo />` injecté dans le `layout` principal.
- [x] Vérifier la présence des meta titles, descriptions, et og:tags pour Elite Lyon.
- **Verification:** Inspection du `<head>` généré pour la page d'accueil.

## Step 3: Nettoyage UX et Code Mort
- [x] Nettoyer les console.log() et le code de débogage.
- [x] Valider la responsivité des formulaires de réservation (si présents).
- **Verification:** Build local sans warnings majeurs (`pnpm build`).
</plan>
