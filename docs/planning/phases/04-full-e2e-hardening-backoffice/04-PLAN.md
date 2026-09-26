# Phase 4: Full E2E & Hardening Backoffice

## 🎯 Objectif
Sécuriser le parcours complet du Backoffice avec Playwright, depuis l'inscription jusqu'aux fonctionnalités chauffeurs (Booking, Assignation, Rating).

## 📋 Tâches (GSD)

- [x] **Tâche 1 :** Setup de l'environnement de test E2E isolée (Base de données locale ou mockée) pour ne pas polluer la Prod.
- [x] **Tâche 2 :** Scénario E2E 1 : Inscription, Onboarding Chauffeur, Création Profil, Ajout Véhicule.
- [x] **Tâche 3 :** Scénario E2E 2 : Réservation manuelle d'une course, acceptation, et passage au statut `paid` puis `completed`.
- [x] **Tâche 4 :** Scénario E2E 3 : Tentative d'accès non autorisé (Test RLS) sur une course d'un autre tenant.
- [x] **Tâche 5 :** Scénario E2E 4 : Processus complet d'évaluation (Rating) de la course.

## 🛑 Crash-Test & Validation
- **Risque identifié :** Tester sur la vraie BDD de dev risque de créer des centaines de faux comptes.
- **Solution requise :** Créer un setup avec `supabase start` (local) ou utiliser une API d'injection/suppression propre avant chaque test.
