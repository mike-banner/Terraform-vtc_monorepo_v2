# Phase 5: Refonte Design Complète UI/UX (Backoffice Uniquement)

## 🎯 Objectif
Sublimer l'interface du Backoffice (et du Master Admin) en appliquant des standards "Impeccable & Taste". Il s'agit d'une refonte totale de l'apparence visuelle (Dashboard, Login, Tables) sans toucher à la logique métier profonde.

## 📋 Tâches (GSD)

- [x] **Tâche 1 :** Définir la nouvelle charte graphique (Couleurs, Typographies modernes). Utilisation de **"Plus Jakarta Sans"** (ou "Outfit") pour s'aligner sur la vibe tech/premium validée en Phase 6.
- [x] **Tâche 2 :** Refonte de la page de Login (Inspiration Awwwards : type *Handhold Login* ou *Admin Haven*).
  - **Layout "Split Screen 50/50" :** L'actuel standard absolu des SaaS haut de gamme.
  - **Panneau de Gauche (Visuel) :** Un fond profond avec une image abstraite ou un dégradé "mesh" subtil (rappelant l'élégance nocturne du VTC). Ce panneau reste fixe et occupe la moitié de l'écran.
  - **Panneau de Droite (Formulaire) :** Ultra-minimaliste. Un gros titre en *Plus Jakarta Sans*. Des champs de texte sans boîte (juste une ligne discrète en bas qui s'illumine au clic - Floating Labels). Un seul gros bouton d'action avec un léger effet "Glow" au survol.
- [x] **Tâche 3 :** Mise à jour des composants UI du Dashboard (`@repo/ui`) pour s'aligner sur la charte (Boutons, Inputs, Cards).
  → **Livrée par substitution :** le package `@repo/ui` n'a jamais existé (`packages/` ne contient que `database/`).
  Les composants canoniques vivent dans `apps/vtc-backoffice/src/components/ui/`, non partagés entre apps.
- [x] **Tâche 4 :** Amélioration des micro-interactions (Hover, Active states, Squelettes de chargement).
  → Squelettes `animate-pulse` sur `login`, `app/dashboard`, `app/ledger`, `admin/dashboard`, `waiting-approval`.
- [x] **Tâche 5 :** Ajustement de la hiérarchie visuelle globale du Backoffice.

## 🛑 Crash-Test & Validation
- **Risque :** Casser des fonctionnalités en modifiant la structure DOM.
- **Validation :** Relancer la suite E2E Playwright de la Phase 4 après chaque grosse itération UI pour garantir que les sélecteurs et le flow fonctionnent toujours.
