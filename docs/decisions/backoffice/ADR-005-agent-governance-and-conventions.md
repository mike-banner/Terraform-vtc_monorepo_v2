# ADR-005: Gouvernance des Agents IA et Conventions de Codage

## Contexte
Le projet est développé par un développeur solo collaborant avec plusieurs agents IA (Claude Code, Antigravity). Pour garantir la cohérence et éviter les réécritures destructives, un protocole strict d'écriture et de mémoire est nécessaire.

## Décisions

### 1. Protocole Tri-Mémoire local
Tout agent intervenant sur le dépôt doit mettre à jour les fichiers de mémoire locale dans `.ai_memory/` après chaque modification :
- `HISTORY.md` : Consigner les faits réalisés avec date (YYYY-MM-DD) et résumé en 1 ligne.
- `EVOLUTION.md` : Suivre le backlog d'idées futures.
- `PLAN_ARCHITECTURE.md` : Mettre à jour uniquement si la roadmap globale est impactée.

### 2. Formattage du Code et Traçabilité
- **Commentaire de chemin absolu** : Chaque fichier créé ou modifié doit inclure son chemin absolu en en-tête (ex: `// /src/lib/utils.ts` ou `<!-- /docs/readme.md -->`).
- **Verrouillage Supabase** : Interdiction absolue d'utiliser le MCP Supabase (écriture directe). Passer uniquement par les credentials du `.env` via REST/JSON pour forcer le respect des politiques de sécurité locales.
- **Types TS** : Exécuter `npm run gen:types` avant toute modification impactant la structure de données.

## Statut
Accepté et implémenté.
