# Phase 02: Refonte UX et UI du Backoffice - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning
**Source:** User discussion / Impeccable Audit

<domain>
## Phase Boundary

Refactorisation de l'expérience utilisateur et de l'interface du Backoffice (Dashboard, gestion des alertes, et contraste). L'objectif est de rendre le Dashboard plus opérationnel, particulièrement sur mobile, sans modifier la charte graphique globale.
</domain>

<decisions>
## Implementation Decisions

### 1. Dashboard Layout (dashboard.astro)
- Remonter les informations opérationnelles urgentes (Urgences/Retards) au sommet de l'écran.
- Déplacer la liste des véhicules hors du Dashboard (suppression de la carte statique) vers sa page dédiée pour libérer de l'espace.

### 2. Gestion des Erreurs (UI)
- Remplacer les appels bloquants `alert()` natifs par un système de notifications non-intrusif (Toasts) dans toute l'application Backoffice (notamment dans `VehicleList.tsx`).

### 3. Accessibilité (Contraste)
- Améliorer le contraste des textes sur les boutons (passer de `text-slate-500` à `text-white/60` ou équivalent) pour une meilleure lisibilité en extérieur.
</decisions>

<canonical_refs>
## Canonical References

### UX Audit
- `.impeccable/apps/backoffice/critique/2026-05-31T20-36-31Z__app-dashboard-home-tab.md` — Contient les feedbacks originaux d'audit sur le contraste et la pollution visuelle.
</canonical_refs>

<specifics>
## Specific Ideas
- Création d'un composant `Toast.tsx` simple pour le backoffice si aucun n'est disponible.
</specifics>

<deferred>
## Deferred Ideas
- Refonte des autres pages du backoffice en dehors du Dashboard et de la page véhicules.
</deferred>
