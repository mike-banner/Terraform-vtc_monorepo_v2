# ADR 0003 : Sites d'une instance fixés à la compilation

- **Date** : 2026-10-02
- **Statut** : Accepté
- **Auteur** : Mike

Remplace l'ADR 0002 pour le choix du site ; la résolution du tenant par domaine reste valable.

## Contexte
Chaque entreprise cliente a une instance dédiée, sur ses propres comptes (D-25). Une instance contient plusieurs tenants, chacun
avec un seul site (D-28, D-30). Le dépôt est public. La table de domaines en dur dans le routeur et le glob `sites/*`
publiaient des domaines et embarquaient tous les sites dans chaque build ; des pages de tunnel copiées par site portaient en
outre des textes d'un client.

## Décision
- Le site est choisi par le domaine dans `SITE_MAP` (`domaine=code,…`), fournie à la compilation : **un domaine par site**,
  un tenant par site. Un domaine ou un site en double fait échouer la compilation.
- `PUBLIC_SITE` est le site par défaut (domaine inconnu, preview, localhost) et est obligatoire : sans lui, le build échoue,
  même avec un `.env` local.
- Un site = sa landing (`pages/index.astro`) et sa configuration (`config.ts`), plus assets et styles. Les tunnels et les
  pages fonctionnelles sont des routes communes qui lisent la configuration du site (`configDuSite()`), avec des valeurs
  neutres par défaut.
- Seuls les sites listés sont compilés, via le module virtuel `virtual:vtc-sites` (aucun glob sur `src/sites/*`).
- Le modèle vide `_modele` et la démo `elite-lyon` (sans domaine) sont seuls versionnés. Le contenu des sites clients vit
  hors dépôt, dans un stockage privé, récupéré avant la compilation et ignoré par git.
- `SITE_MAP` n'est jamais dans le dépôt ni dans une variable GitHub (secret) ; les messages d'erreur ne citent aucun domaine.
- Le tenant reste résolu par le domaine via `get_public_tenant` (`primary_domain` = domaine du site), avec repli sur le
  `tenantId` de la configuration du site.

## Conséquences
- Un build par instance, comme c'est déjà le cas pour les variables `PUBLIC_*`.
- Ajouter un site : créer son tenant, copier `_modele`, l'ajouter à `SITE_MAP`, recompiler.
- Tous les tenants d'une instance partagent la clé Stripe de l'instance : ils appartiennent à la même entreprise (D-30).
- Le `www.` d'un domaine se redirige au niveau de Cloudflare au lieu d'être une seconde entrée.
