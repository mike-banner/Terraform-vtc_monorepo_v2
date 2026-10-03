# ADR-015 : Backoffice en React, clôture de la phase 16

## Statut
Accepté (2026-10-03). Applique ADR-011 pour les pages ; prépare le retrait d'Astro en phase 17.

## Contexte
- ADR-011 fixe la cible : application React en SPA, temps réel par Broadcast, PWA.
- La phase 16 a réécrit toutes les pages métier en React. Il restait à retirer l'Astro métier et à empêcher son retour.

## Décision
Livré en phase 16 :
- Pages React (`src/app`, `src/features`, `src/ui`) montées par deux pages Astro attrape-tout en `client:only` : `src/pages/app/[...path].astro` et `src/pages/[...path].astro`, plus le document `src/layouts/AppDocument.astro`. Ce sont les seuls `.astro` autorisés.
- Montants et aperçus de prix calculés par RPC serveur, jamais dans le navigateur.
- Retirés : layouts et composants Astro, `src/scripts`, routes `api/tenant/*` et `api/missions/*` sans appelant (remplacées par des RPC ou Edge Functions), dépendances inutilisées.
- Garde `scripts/check-astro-residue.mjs` en CI (job verify) : échec si un `.astro` hors liste, un dossier `src/scripts`, un `<script` dans un `.astro` autorisé ou une route API hors `export-csv` / `export-fec` apparaît.

Restent jusqu'à la phase 17, strictement : les trois `.astro` ci-dessus, `src/middleware.ts`, `astro.config.mjs` et l'adaptateur Cloudflare, `export-csv.ts` et `export-fec.ts`.

## À retirer en phase 17
- `astro.config.mjs`, `@astrojs/cloudflare`, `@astrojs/react`, `output: "server"`.
- Les trois `.astro` autorisés, remplacés par `index.html` et `main.tsx` Vite.
- `src/middleware.ts`, remplacé par `RequireRole`, `SetupGate` et `useTenantStatus` côté React, et par la RLS et les RPC gardées côté base. La prolongation de session pendant une course doit être reprise dans ce remplacement.
- `export-csv.ts` et `export-fec.ts`, réécrits en Edge Functions avec jeton Bearer.
- `ROUTE_POLICY` et `scripts/check-route-policy.mjs`, devenus sans objet une fois le middleware retiré ; `check-astro-residue` sera retiré avec le dernier `.astro`.
- Déploiement Cloudflare Pages en SPA statique, avec une CSP configurée par instance.

## Conséquences
- La phase 17 déplace une application React déjà complète, sans ménage préalable.
- Toute régression vers Astro métier échoue en CI avant fusion.
