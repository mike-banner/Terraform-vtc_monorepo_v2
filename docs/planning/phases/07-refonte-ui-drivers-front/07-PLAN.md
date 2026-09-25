# Phase 7: Refonte Design "Cyber-Luxe" (Drivers Front)

Ce plan détaille la refonte complète de l'interface client, appliquée **après** le câblage dynamique des données (Phase 6). L'objectif est d'implémenter l'esthétique *Google Cloud Infrastructure* (Dark Mode, Glassmorphism, Typographie géométrique) adaptée au VTC de luxe.

## 🎯 Objectifs
- **Refactoring UI :** Décomposer les tunnels en composants réutilisables (DRY).
- **Design System :** Implémenter le "Mobile-First" (80% des réservations), le Glassmorphism et les effets Glow.
- **Typographie :** Uniformiser avec "Plus Jakarta Sans" ou "Outfit".

## Proposed Changes

> **⚠️ Volet design abandonné.** Les sections 1 et 3 ci-dessous décrivent une direction artistique
> « Cyber-Luxe » (fond `#0a0a0a`, Plus Jakarta Sans) qui **n'a pas été retenue**. La DA effectivement
> livrée est « steel blue » (`#0B0F15` fond, `#151F2B` surfaces, `.glass-card` dans `src/styles/global.css`),
> introduite par les commits `b71db2a` → `3b8aa3b`. Il n'existe pas de `tailwind.config.*` dans
> `apps/vtc-websites` : la config passe par `@tailwindcss/vite` et les variables CSS de `global.css`.
> Seul le volet 2 (factorisation) de ce plan a été exécuté.

### 1. ~~Architecture du Design System (Tailwind)~~ — ABANDONNÉ
#### [MODIFY] `apps/drivers-front/src/styles/global.css`
- **Fond "Deep Dark" :** `#0a0a0a`.
- **Glassmorphism :** Utilitaires `.glass-card`.
- **Glow Effects :** Ombres portées colorées subtiles.

#### [MODIFY] `apps/drivers-front/tailwind.config.mjs`
- **Typographie :** Intégration de **"Plus Jakarta Sans"** (ou **"Outfit"**), clones open-source parfaits de "Google Sans".

### 2. Refonte & Factorisation des Tunnels
#### [DONE] Composants Réutilisables (`apps/vtc-websites/src/components/tunnels/steps/`)
- `<ContactStep />` : Étape 4 (Coordonnées B2C + Checkbox B2B Entreprise).
- `<VehicleGridStep />` : Étape 2 (Affichage dynamique des véhicules et prix).
- `<DateTimePicker />` : Gestion unifiée des champs Flatpickr/Natif. Prop `variant='native' | 'flatpickr'`,
  prop `themeColor` (accent / green / purple / amber / orange). L'init Flatpickr de `TunnelLayout.astro`
  cible désormais les classes `.js-fp-date` / `.js-fp-time` au lieu des ids uniques `#flatpickr-date` / `#flatpickr-time`,
  ce qui autorise plusieurs sélecteurs par page.

#### [DONE] `apps/vtc-websites/src/core/tunnel-core.ts`
- Extraction et centralisation du script `initTunnel()` (Machine à état, validation `showStep`, masquage/affichage).

#### [MODIFY] Fichiers dans `apps/vtc-websites/src/sites/elite-lyon/pages/`
- Abandonné avec le reste du volet Cyber-Luxe (floating labels, bottom bar) : la DA steel blue conserve
  les cartes et la navigation existantes.

## Verification

**Fait :**
- `pnpm --filter @vtc/vtc-websites build` passe (Astro 5.17, build serveur + client OK) après extraction.
- Aucune référence résiduelle à `#flatpickr-date` / `#flatpickr-time` ni à un `<input type='date'|'time'>` inline
  dans `src/components/tunnels/`.
- Le composant ne change aucun `name` de champ : les payloads envoyés par les 4 tunnels sont identiques à avant.

**À valider manuellement (nécessite Supabase + un tenant, non exécutable ici) :**
- Le calendrier Flatpickr s'ouvre bien sur l'étape 3 du tunnel Transfert (bascule id → classe).
- Responsive iPhone 13/14 Pro sur les 4 tunnels.

**Abandonné avec le volet design :** audit Lighthouse > 90 et contraste sur fond noir profond — sans objet,
la DA livrée n'est pas sur fond noir profond.
