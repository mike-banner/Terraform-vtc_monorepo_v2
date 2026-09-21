# AGENTS.md — Règles projet (toutes apps)

Fichier de référence pour tout agent IA travaillant sur ce monorepo.
Règles spécifiques par app : `apps/vtc-backoffice/CLAUDE.md`, `apps/vtc-websites/CLAUDE.md`.

## Commits & signatures

- **Aucune marque IA dans les commits** : pas de trailer `Co-Authored-By: <agent>`, pas de mention « Generated with <agent> », pas d'emoji d'outil IA.
- Auteur et committer = identité humaine uniquement. L'agent ne se crédite jamais.
- Format du message : `type(scope): description` en anglais, impératif, une phrase (cf. `git log`).
- Ne jamais committer sans demande explicite de l'utilisateur.

## Secrets

- Jamais de secret en clair dans le repo : ni `.env`, ni `.dev.vars`, ni `*.pem`, ni clé `sb_secret_*` / `sk_live_*` / `whsec_*`.
- Seules les clés *publishable* Supabase (`sb_publishable_*`) sont autorisées côté client.
- `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY` : variables d'environnement Cloudflare / secrets Edge Functions uniquement.
- Avant tout commit : relire `git diff --cached` et vérifier qu'aucun fichier d'environnement n'est stagé.

## Base de données

- Toute migration vit dans `supabase/migrations/` (`YYYYMMDDHHMMSS_nom.sql`), jamais d'édition manuelle en prod.
- Accès public (rôle `anon`) : uniquement via des RPC `SECURITY DEFINER` n'exposant que les colonnes nécessaires. Pas de `using (true)` sur une table contenant des données clients.
- Après tout changement de schéma : `pnpm --filter @vtc/vtc-backoffice gen:types`.
