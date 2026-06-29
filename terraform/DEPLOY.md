# Runbook de déploiement — saas-starter-template

## Prérequis

- **terraform** ≥ 1.5 : https://developer.hashicorp.com/terraform/install
- **supabase CLI** : https://supabase.com/docs/guides/cli
- Compte **Terraform Cloud** (organisation + workspace configurés)
- Compte **Supabase** (projet existant ou à créer)
- Compte **Cloudflare** (accès Pages)

---

## Variables d'environnement à exporter

Exportez ces variables dans votre shell (ou dans votre pipeline CI) avant de lancer `deploy.sh`.
**Ne jamais committer ces valeurs.**

| Variable | Source |
|---|---|
| `TF_CLOUD_ORGANIZATION` | Nom de votre organisation Terraform Cloud (dashboard → Settings) |
| `TF_WORKSPACE` | Nom du workspace Terraform Cloud (ex : `saas-starter-prod`) |
| `SUPABASE_ACCESS_TOKEN` | Dashboard Supabase → Account → Access Tokens |
| `TF_VAR_supabase_access_token` | Identique à `SUPABASE_ACCESS_TOKEN` (requis par le provider Terraform) |
| `TF_VAR_cloudflare_api_token` | Dashboard Cloudflare → My Profile → API Tokens (droits Edit sur Pages) |
| `TF_VAR_supabase_db_password` | Mot de passe de la base de données Supabase (à générer) |
| `TF_VAR_supabase_organization_id` | Dashboard Supabase → Organization Settings → Organization Slug |
| `TF_VAR_cloudflare_account_id` | Dashboard Cloudflare → visible dans l'URL (format `account/<id>`) |
| `TF_VAR_environment` | Nom d'environnement (ex : `production`, `staging`) |

### Exemple d'export

```bash
export TF_CLOUD_ORGANIZATION="mon-org"
export TF_WORKSPACE="saas-starter-prod"
export SUPABASE_ACCESS_TOKEN="sbp_..."
export TF_VAR_supabase_access_token="$SUPABASE_ACCESS_TOKEN"
export TF_VAR_cloudflare_api_token="..."
export TF_VAR_supabase_db_password="..."
export TF_VAR_supabase_organization_id="..."
export TF_VAR_cloudflare_account_id="..."
export TF_VAR_environment="production"
```

---

## Déploiement standard (1 commande)

```bash
cd terraform
./deploy.sh
```

`deploy.sh` exécute la séquence suivante dans l'ordre :

1. **Préflight** — vérification des binaires (`terraform`, `supabase`) et des variables d'env requises
2. `terraform init -input=false` — initialise le backend Terraform Cloud
3. `terraform fmt -check -recursive` + `terraform validate` — contrôle de qualité
4. `terraform apply -input=false` — provisionnement réel (Supabase + Cloudflare Pages). Confirmation interactive demandée.
5. `terraform output -raw supabase_project_ref` — récupère le project ref
6. `supabase link --project-ref <ref>` — liaison du CLI au projet
7. `supabase db push` — application des migrations (intégration Phase 3)
8. `supabase functions deploy stripe-webhook` — déploiement de la edge function (intégration Phase 4)
9. Affichage de l'URL live (`https://<sous-domaine>.pages.dev`)

Le `site_url` est câblé **automatiquement** au sous-domaine Cloudflare Pages lors de cet apply unique — aucune intervention manuelle requise pour le cas par défaut.

---

## Domaine personnalisé (pattern double-apply)

Pour utiliser un domaine personnalisé (`https://mon-domaine.com`) à la place du sous-domaine `.pages.dev`, un second apply est nécessaire :

**Étape 1 — Premier déploiement (sous-domaine par défaut)**

```bash
./deploy.sh
```

Cela crée le projet Cloudflare Pages et câble `site_url` sur le sous-domaine `.pages.dev`.

**Étape 2 — Configurer le domaine personnalisé**

Dans le dashboard Cloudflare Pages → Custom Domains, ajoutez votre domaine et attendez la propagation DNS.

**Étape 3 — Second apply avec le domaine custom**

```bash
export TF_VAR_site_url="https://mon-domaine.com"
terraform apply -input=false
```

Ce second apply réécrit les auth settings Supabase (`site_url`, `additional_redirect_urls`) avec le domaine personnalisé.

> Le second apply n'est nécessaire **que** pour un domaine personnalisé. Le cas `.pages.dev` ne requiert qu'un seul apply.

---

## Secrets de la Edge Function (stripe-webhook)

Après le premier `./deploy.sh`, injectez les secrets nécessaires à la edge function via le CLI Supabase :

```bash
supabase secrets set --project-ref <PROJECT_REF> \
  STRIPE_SECRET_KEY="sk_live_..." \
  STRIPE_WEBHOOK_SECRET="whsec_..."
```

| Secret | Source |
|---|---|
| `STRIPE_SECRET_KEY` | Dashboard Stripe → Developers → API keys → Secret key |
| `STRIPE_WEBHOOK_SECRET` | Dashboard Stripe → Developers → Webhooks → (endpoint) → Signing secret |

> `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont injectés automatiquement par Supabase dans toutes les edge functions — pas besoin de les définir manuellement.

Pour enregistrer l'endpoint webhook sur Stripe, pointez sur :
```
https://<PROJECT_REF>.supabase.co/functions/v1/stripe-webhook
```

Événements à écouter minimum : `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.

---

## Mode non-interactif (CI)

```bash
./deploy.sh --auto-approve
```

Passe `-auto-approve` à `terraform apply`. À utiliser uniquement en CI avec des secrets injectés sécurisés. **Ne jamais utiliser en local sur un environnement de production sans revue préalable du plan.**
