---
type: project-readme
projet: vtc_repo_v2
date: 2026-08-15
tags: [projet/vtc_repo_v2]
status: active
summary: "Plateforme VTC v2 Monorepo - Turborepo, Supabase, WebSockets & Playwright"
---

# Projet : vtc_repo_v2

## 🎯 En une phrase
Plateforme de réservation et gestion de chauffeurs VTC v2 (Monorepo Turborepo haute performance).

## 🛠️ Stack Technique
- **Orchestration Monorepo** : Turborepo + pnpm
- **Base de Données & Auth** : Supabase PostgreSQL (`@supabase/supabase-js`)
- **Temps Réel** : WebSockets (`ws`)
- **Tests End-to-End** : Playwright (`@playwright/test`)
- **Dossier Local** : `~/projects/vtc/vtc_repo_v2`

## 🔗 Liens clés
- **Dépôt Git** : `~/projects/vtc/vtc_repo_v2`
- **Prod / Supabase Project** : Dashboard Supabase Cloud

## ⚠️ Invariants à ne jamais casser
- Utiliser `pnpm` et `turbo` pour tous les scripts d'intégration.
- Les migrations SQL doivent être appliquées via Supabase CLI.

## 📁 Structure & Ressources
- **Décisions d'Architecture** : voir `decisions/`
- **Runbooks & Déploiement** : voir `runbooks/`
- **Retours d'Expérience** : voir `learnings/`

## 🚀 État actuel & Prochaines Étapes
- **Statut** : Version 2 en cours d'optimisation
- **Prochaine étape** : Validation de la suite E2E Playwright
