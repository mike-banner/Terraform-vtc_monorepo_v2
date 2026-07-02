# ADR-010 : Migration des couleurs hardcodées vers les tokens sémantiques (Phase 6)

- **Date** : 2026-06-30
- **Statut** : En cours (changements non commités au moment de la rédaction — vérifier `git status` avant d'assumer que c'est terminé)

## Contexte

Le dashboard backoffice utilisait des classes Tailwind couleur en dur (`indigo-*`, `bg-brand-dark`) au lieu des tokens sémantiques du design system (`primary`, etc.), rendant le re-thème impossible sans grep-and-replace manuel à chaque fois. La Phase 6 (cf. `PRODUCT.md` — design principle « Cohérence des tokens — jamais de couleur hardcodée quand un token sémantique existe ») vise à aligner toutes les pages du dashboard sur ces tokens, sans changer la structure des pages.

## Décision

- Migration systématique `indigo-*` → tokens `primary` sur les composants (`Button.astro`, `Badge.astro`, `DataTable.astro`, `KPIGrid.astro`, `Sidebar.astro`) et les pages (`bookings`, `dashboard`, `ledger`, `pricing`, `profile`, `settings`, `setup`, `vehicles`).
- Suppression des classes `bg-brand-dark` non définies dans le thème (legacy, sans effet réel).
- États hover sur fond `primary` : opacité ajustée pour rester lisible (cohérence avec le pattern d'opacité déjà utilisé ailleurs dans le design system).
- Hiérarchie typographique conservée : `font-black` pour les valeurs chiffrées, `text-muted-foreground` pour les labels (déjà en place, non modifié par cette migration).

## Conséquences

- Toute nouvelle UI backoffice doit utiliser les tokens sémantiques existants — ne jamais réintroduire de couleur Tailwind en dur (règle déjà actée dans `apps/backoffice/CLAUDE.md`).
- Le composant `Badge.astro` conservait une variante `indigo` définie mais non utilisée après migration — à supprimer si confirmé mort, ou à documenter si gardée pour compat externe.
