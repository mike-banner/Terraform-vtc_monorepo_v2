# Modèle de site vide

Un site = une landing (`pages/index.astro`, seule page servie), sa configuration (`config.ts`), ses `assets/` et `styles/`
(et les `components/` / `layouts/` de la landing). Les tunnels sont communs (`src/pages/tunnels/`) et lisent `config.ts`.

Un site = un tenant = un domaine (D-29 b, D-30).

Créer un site : copier `_modele` vers `src/sites/<code-neutre>/` (dossier ignoré par git), le personnaliser, l'archiver dans
le bucket R2 privé (`docs/INSTANCES.md`). Ne jamais committer un site client.

Compiler avec `PUBLIC_SITE=<code par défaut>` et `SITE_MAP=domaine=code,…`.
