# Phase 02: Refonte UX et UI du Backoffice - Plan

**Status:** Complete
**Context:** [02-CONTEXT.md](02-CONTEXT.md)

<threat_model>
- **Assets modified:** Frontend UI logic (`dashboard.astro`, `VehicleList.tsx`).
- **Risks:** Risque faible. Les modifications ne touchent pas à la logique d'authentification ou aux règles de sécurité des bases de données. Pas de nouveaux points d'entrée (endpoints) créés.
- **Mitigation:** Les nouvelles notifications n'exposeront aucune donnée sensible en clair, uniquement des messages d'état génériques.
</threat_model>

<plan>
## Step 1: Création du système de Toast (UI)
- [x] Créer un composant réutilisable `Toast.tsx` dans `apps/backoffice/src/components/ui/` ou utiliser un système existant.
- [x] Ajouter un contexte de notification ou utiliser Zustand/React state pour piloter l'affichage global des Toasts.
- **Verification:** S'assurer que le composant est monté correctement sans erreurs React.

## Step 2: Refonte du Dashboard (Mobile-first)
- [x] Modifier `apps/backoffice/src/pages/app/dashboard.astro`.
- [x] Remonter les KPIs "Urgences/Retards" et "Missions en cours" en haut de la page.
- [x] Supprimer ou masquer le composant `VehicleList` ou le lien statique de la page d'accueil pour gagner de la place, et diriger l'utilisateur vers la page `/app/vehicles` au besoin.
- **Verification:** L'affichage mobile donne priorité absolue aux alertes.

## Step 3: Remplacement des alert() bloquantes
- [x] Identifier toutes les instances de `alert()` dans `apps/backoffice/src/components/vehicles/VehicleList.tsx`.
- [x] Remplacer par des appels au nouveau système de Toast.
- **Verification:** Provoquer une erreur volontaire de chargement et s'assurer que le Toast apparaît sans bloquer le fil d'exécution UI.

## Step 4: Corrections Accessibilité & Contraste
- [x] Parcourir les composants interactifs (boutons secondaires, badges) dans le Backoffice.
- [x] Remplacer les classes comme `text-slate-500` sur fond foncé par des classes plus contrastées (`text-white/80`, ou `text-slate-200`).
- **Verification:** Inspection visuelle ou Lighthouse accessibility.
</plan>
