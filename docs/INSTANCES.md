# Instances : installation et mise à jour

Runbook de l'installation d'une instance cliente. Le dépôt est **public** : on n'y trouve que des noms de variables, des
placeholders `<...>` et des domaines `.invalid`.

## Dépôt public

Le code est visible de tous ; ce qui est vendu est l'installation, la maintenance et la conformité. Conséquence : rien de
propre à un client n'entre dans le dépôt, ni dans `.planning/` (copié dans `docs/planning` par `sync-planning.mjs`).

## Principes

- L'instance 1 est celle du développeur (son Supabase, son Cloudflare, ses sites). Chaque client est une instance de plus,
  sur **ses propres comptes** : un projet Supabase, un compte Cloudflare, un compte Stripe du client (paiement direct sur la
  clé du client, 0 commission) et un workspace Terraform Cloud en exécution **Local** (état gardé par Terraform Cloud,
  exécution sur la machine du développeur).
- Un seul dépôt git pour toutes les instances.
- Une instance contient un ou plusieurs tenants, un site et un domaine par tenant. La clé Stripe étant celle de l'instance,
  tous ses tenants encaissent sur le même compte : ce sont des marques d'une **même entreprise**. **jamais deux clients
  (entreprises) dans la même base** : deux entreprises = deux instances. Les tenants d'une base sont isolés par la RLS
  (`supabase/lint/rls_role_checks.sql`).
- Un compte du backoffice appartient à un seul tenant : un propriétaire de deux marques utilise deux adresses e-mail.
- Jamais de superadmin chez un client (`enable_superadmin = false`).
- Chaque livraison est un **tag git** au nom neutre (`livraison-AAAA-MM-JJ`, jamais un nom de client), installée depuis ce
  tag et notée au registre.

## Bucket R2 privé

Un bucket privé sur le compte Cloudflare **du développeur** (nom choisi par lui, jamais écrit dans le dépôt, aucun accès
public, aucun domaine rattaché) contient :

- `registre/instances.md` : le registre des instances, **sans aucun secret** ;
- `sites/<code>.tar.gz` : le contenu des sites clients.

Jeton : jeton API R2 « lecture et écriture d'objets » **limité à ce seul bucket**. Ses 4 valeurs (`R2_ENDPOINT`,
`R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) vivent dans un fichier de la machine du développeur, hors dépôt
(`~/.config/<dossier privé>/r2.env`, `chmod 600`), chargé par `set -a; . <fichier>; set +a`. **Jamais** dans le dépôt, dans
`.planning/`, dans GitHub (ni variable ni secret), ni dans R2 lui-même.

Rotation : en cas de doute, révoquer le jeton dans le tableau de bord Cloudflare et en créer un autre. Un jeton volé ne
donne accès qu'à ce bucket (registre sans secret et contenus de sites).

Registre : `scripts/r2-prive.sh get registre/instances.md <fichier hors dépôt>`, édition, puis
`scripts/r2-prive.sh put <fichier> registre/instances.md`, puis suppression de la copie locale. `get` refuse une
destination située dans le dépôt.

## Sites d'une instance

Un site = un tenant = un domaine.

- `PUBLIC_SITE` : code du site par défaut (`^[a-z0-9_-]{2,40}$`, neutre, jamais le nom du client).
- `SITE_MAP` : `domaine=code,domaine=code`, **un-pour-un** (un domaine par site, un site par domaine). Le `www.` n'est pas
  une seconde entrée : le rediriger vers le domaine par une règle de redirection Cloudflare (procédure exacte à vérifier à
  la première installation). Le domaine d'un site est le `TENANT_DOMAIN` (`primary_domain`) de son tenant.
- Un site ne contient que sa landing (`pages/index.astro`), sa configuration (`config.ts` : `tenantId`, nom, contact de
  repli, lieux, listes et placeholders des tunnels, valeurs neutres par défaut dans `src/core/site-config.ts`), ses
  `assets/` et `styles/` (et les `components/` / `layouts/` de la landing). Les tunnels sont communs et lisent cette
  configuration ; `r2-prive.sh` refuse une archive contenant d'autres pages.
- Seuls `elite-lyon/` (démonstration) et `_modele/` (modèle vide) sont suivis par git (liste blanche du `.gitignore`).

**Créer un site** : `cp -r apps/vtc-websites/src/sites/_modele apps/vtc-websites/src/sites/<code>` (ignoré par git),
personnaliser la landing et `config.ts`, `pnpm --filter @vtc/vtc-websites exec tsc --noEmit`, puis
`tar -czf <hors dépôt>/<code>.tar.gz -C apps/vtc-websites/src/sites/<code> .` et
`scripts/r2-prive.sh put <hors dépôt>/<code>.tar.gz sites/<code>.tar.gz`.

Avant chaque compilation d'une instance : `scripts/r2-prive.sh sites <codes>` (fait par `install-instance.sh`). Il récupère
les sites listés et retire tout autre dossier de site non suivi (contenu d'un autre client).

**Ajouter un site (tenant) à une instance existante** :

1. `node scripts/seed-instance.mjs` avec les variables du nouveau tenant (`TENANT_NAME`, `TENANT_DOMAIN`, `OWNER_EMAIL`
   propre à ce tenant). Le script refuse un domaine déjà pris par le tenant d'un autre propriétaire et un propriétaire déjà
   rattaché à un autre tenant.
2. Reporter le `TENANT_ID=...` affiché dans le `tenantId` du `config.ts` du site, puis archiver le site dans R2.
3. Ajouter `domaine=code` à `SITE_MAP` dans le fichier d'environnement de l'instance.
4. `r2-prive.sh sites`, `tsc --noEmit`, build, `wrangler pages deploy` depuis la machine.
5. Rattacher le domaine au projet Pages du site.
6. Noter le site et son tenant au registre.

## Règle GitHub

Le dépôt est public, donc ses journaux d'Actions aussi. Une valeur qui identifie un client (domaine, `SITE_MAP`, code, ref
Supabase, compte Cloudflare, workspace) n'est **jamais** une variable GitHub (`vars.*`, affichée en clair) : secret GitHub
si elle doit vraiment y passer, sinon déploiement depuis la machine du développeur. C'est la règle pour toute instance
cliente. Aucun workflow n'affiche de valeur. Contrôle : `grep -nE '\bvars\.' .github/workflows/*.yml` ne liste que
`DEPLOY_SUPERADMIN`.

## Stripe du client

Le propriétaire ne connecte rien dans le tableau de bord. Le développeur enregistre la clé du client (clé **restreinte**
conseillée : Checkout Sessions en écriture, PaymentIntents en lecture, Refunds en écriture), créée depuis son accès
d'équipe au compte Stripe du client ou reçue par un canal chiffré, **jamais transmise par e-mail en clair**. Il crée
l'endpoint webhook à l'installation ; `tenants.stripe_account_id` reste vide. Dire au client de ne pas toucher à la carte
« Connecter Stripe » du tableau de bord.

## Prérequis d'une installation

- Accès limité reçu sur les comptes du client.
- Page « API Keys » du projet Supabase du client ouverte : clés héritées `anon` / `service_role` présentes, sinon STOP et
  planifier le passage aux clés publishable / secret.
- Stripe : clés live du client et endpoint webhook `https://<ref>.supabase.co/functions/v1/stripe_webhook` avec les
  événements `checkout.session.completed`, `refund.updated`, `refund.failed`.
- Sites du client archivés dans R2.

## Fichier d'environnement

`<code>.instance.env`, sur la machine du développeur, hors dépôt, jamais dans R2 (il contient des secrets) :
`INSTANCE_CODE`, `PROJECT_PREFIX`, `TF_CLOUD_ORGANIZATION`, `TF_WORKSPACE`, `TF_VAR_cloudflare_api_token`,
`TF_VAR_cloudflare_account_id`, `TF_VAR_supabase_url`, `TF_VAR_supabase_anon_key`, `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`, `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_SITE_URL`, `PUBLIC_SITE`, `SITE_MAP`
(facultative), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `OWNER_EMAIL`, `TENANT_NAME`,
`TENANT_DOMAIN`, `BACKOFFICE_URL`, plus les 4 `R2_*` (chargées depuis le fichier R2 avant le script).

## Installation

1. Poser le tag de livraison, `git checkout <tag>`.
2. `scripts/install-instance.sh <fichier> --check` (préflight, aucune écriture).
3. `scripts/install-instance.sh <fichier>` : une confirmation avant chaque écriture (Terraform après lecture du plan,
   `db push` après `--dry-run`, `config push`, secrets, fonctions, tenant et propriétaire, sites et build, déploiement
   depuis la machine). Répéter d'abord sur un projet de test avec un site d'essai copié de `_modele` et archivé dans R2.
4. Le propriétaire accepte l'invitation, termine l'assistant (véhicule, tarifs de départ), règle sa politique d'annulation
   et son adresse ; chaque domaine de `SITE_MAP` est rattaché au projet Pages du site.

## Mise à jour

Une instance à la fois, à la main, l'instance du développeur d'abord (CI normale). Chaque mise à jour d'un client part d'un
tag de livraison (`git checkout <tag>`), jamais d'une branche. Ordre imposé : migrations, puis fonctions, puis front.
Pour chaque client :

1. charger son fichier d'environnement ;
2. `python3 scripts/check_migration_drift.py --ref "$SUPABASE_PROJECT_REF"` ;
3. `supabase db push --dry-run` (doit lister exactement les migrations attendues), GO, `db push` ;
4. `functions deploy`, puis `functions delete` des fonctions retirées (liste tenue dans le registre) ;
5. `scripts/r2-prive.sh sites`, build, `wrangler pages deploy` depuis la machine ;
6. `terraform plan` (vide sauf changement voulu) ;
7. relire 3 parcours, mettre à jour le registre avec le tag livré.

## Format du registre

`registre/instances.md` dans R2, une ligne par instance, **aucun secret** : code neutre, client, ref Supabase, compte et
projets Cloudflare, workspace Terraform, domaines et `SITE_MAP`, codes des sites, mode Stripe (test/live, clé restreinte
oui/non), tag git livré et son commit, dernière migration, date, emplacement du fichier d'environnement sur la machine,
contact, confirmation écrite de conformité (date).
