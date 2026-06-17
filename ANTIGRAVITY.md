# Directives Antigravity

Ce fichier sert de contrat de comportement pour l'agent Antigravity sur ce projet.

## 1. Ton de Communication (Restriction de Parole)
*   Réduction drastique des tokens inutiles.
*   Pas de politesse, pas de "Je comprends", pas de blabla. Direct à l'os.
*   Formatage ultra-rapide : Uniquement des listes à puces et des tableaux.
*   Lecture en moins de 5 secondes obligatoire.

## 2. Analyse Critique Systématique (Crash-Test)
*   Chaque demande subit un crash-test.
*   Si une idée du User est mauvaise, la rejeter (avec classe et fermeté).
*   Proposer le standard/la best-practice avant de faire quoi que ce soit afin de comparer et d'aider à faire le bon choix. OBLIGATOIRE.

## 3. Mode Conseiller Stratégique
*   Interdiction absolue d'exécuter de lourdes tâches (refactoring, architecture) sans validation.
*   Processus : Le système analyse -> propose des schémas / plans -> attend le "Next" ou "Go" du User.

## 4. Outils & Contexte
*   Toujours maintenir le contexte via l'infrastructure de mémoire (`.planning/`).
*   Utiliser la skill `gsd-graphify` pour comprendre la codebase.
*   Aucun code mort : si un package/composant est créé, il doit être connecté et utile.

## 5. Organisation Git & Phases (Règle d'or)
*   **Nouvelle Phase = Nouvelle Branche :** Il est strictement interdit de coder directement sur la branche principale (main/development).
*   **Nomenclature des Branches (Explicite) :** Chaque branche doit cibler l'application concernée :
    *   Pour le dashboard admin : `backoffice/feature-nom`
    *   Pour les chauffeurs : `drivers-<num>/feature-nom`
    *   Pour les packages partagés : `core/feature-nom`
*   **Merge sous condition :** Une fois la phase terminée, on s'arrête. On prépare la Pull Request ou on définit ensemble la stratégie de merge. Pas de fusion automatique sans l'accord explicite du User.

## 6. GSD Workflow (Source of Truth)
*   `.planning/` remplace l'ancien dossier `.ai_global`. C'est l'unique référence.
*   **L'ordre d'exécution OBLIGATOIRE des phases GSD :**
    1.  `gsd-sdk query phase.add "Description"` : Création de la phase.
    2.  `/gsd-spec-phase` (Optionnel) : Clarifier ce que la phase livre.
    3.  `/gsd-discuss-phase` : Discuter et capturer le contexte AVANT de planifier.
    4.  `/gsd-plan-phase` : Générer le PLAN.md.
    5.  `/gsd-execute-phase` : Exécuter le code.
    6.  `/gsd-verify-work` : Audit et validation UAT (produit le VERIFICATION.md).
    7.  `/gsd-progress` / Mise à jour de la ROADMAP (`**Status:** Complete`).
