#!/usr/bin/env bash
# Installation d'une instance, pas à pas, avec confirmation avant chaque écriture.
# Script volontairement court (D-22) : l'automatisation de bout en bout attend la deuxième installation.
#
# Usage : scripts/install-instance.sh <fichier.instance.env> [--check]
#   --check : préflight seulement (binaires, variables, sites), aucune écriture.
# Le fichier d'environnement vit hors dépôt (docs/INSTANCES.md). Aucune valeur n'est affichée.
# Jamais de superadmin chez un client : enable_superadmin = false, aucun déploiement du superadmin.
set -euo pipefail

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
cd "$ROOT"

ENVFILE="${1:-}"; MODE="${2:-}"
[ -n "$ENVFILE" ] && [ -f "$ENVFILE" ] || { echo "usage : $0 <fichier.instance.env> [--check]" >&2; exit 1; }
ENVFILE="$(cd "$(dirname "$ENVFILE")" && pwd)/$(basename "$ENVFILE")"
case "$ENVFILE" in "$ROOT"/*) echo "le fichier d'environnement ne doit pas être dans le dépôt" >&2; exit 1 ;; esac
set -a; . "$ENVFILE"; set +a

confirm() { read -r -p "$1 — continuer ? [o/N] " r; [ "$r" = "o" ] || { echo "arrêt avant : $1"; exit 1; }; }

# --- 0. préflight -------------------------------------------------------------
echo "== 0. préflight"
for b in supabase psql pnpm npx node curl tar; do command -v "$b" >/dev/null || { echo "binaire manquant : $b" >&2; exit 1; }; done
command -v terraform >/dev/null || command -v docker >/dev/null || { echo "binaire manquant : terraform ou docker" >&2; exit 1; }
missing=()
for v in INSTANCE_CODE PROJECT_PREFIX TF_CLOUD_ORGANIZATION TF_WORKSPACE TF_VAR_cloudflare_api_token \
  TF_VAR_cloudflare_account_id TF_VAR_supabase_url TF_VAR_supabase_anon_key CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID \
  SUPABASE_PROJECT_REF SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY \
  PUBLIC_SUPABASE_URL PUBLIC_SUPABASE_ANON_KEY PUBLIC_SITE_URL PUBLIC_SITE STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET \
  RESEND_API_KEY EMAIL_FROM OWNER_EMAIL TENANT_NAME TENANT_DOMAIN BACKOFFICE_URL \
  R2_ENDPOINT R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
  [ -n "${!v:-}" ] || missing+=("$v")
done
[ ${#missing[@]} -eq 0 ] || { echo "variables manquantes : ${missing[*]}" >&2; exit 1; }

# sites de l'instance = PUBLIC_SITE + codes de SITE_MAP (domaine=code,domaine=code)
sites=("$PUBLIC_SITE")
if [ -n "${SITE_MAP:-}" ]; then
  IFS=',' read -ra pairs <<<"$SITE_MAP"
  for p in "${pairs[@]}"; do sites+=("${p#*=}"); done
fi
for c in "${sites[@]}"; do [[ "$c" =~ ^[a-z0-9_-]{2,40}$ ]] || { echo "code de site invalide" >&2; exit 1; }; done
echo "préflight OK (${#sites[@]} site(s) : ${sites[*]})"
[ "$MODE" = "--check" ] && exit 0

# --- 1. Terraform ---------------------------------------------------------------
echo "== 1. Terraform"
TF=terraform
command -v terraform >/dev/null || TF="docker run --rm -it -v $ROOT/terraform:/w -w /w -e TF_CLOUD_ORGANIZATION -e TF_WORKSPACE -e TF_VAR_cloudflare_api_token -e TF_VAR_cloudflare_account_id -e TF_VAR_supabase_url -e TF_VAR_supabase_anon_key -v $HOME/.terraform.d:/root/.terraform.d:ro hashicorp/terraform:1.9"
cat >terraform/instance.auto.tfvars <<EOT
enable_superadmin = false
project_prefix    = "$PROJECT_PREFIX"
environment       = "production"
EOT
(cd terraform && $TF init -input=false && $TF plan -input=false)
confirm "terraform apply"
(cd terraform && $TF apply -input=false)

# --- 2. Supabase : base ---------------------------------------------------------
echo "== 2. Supabase"
supabase link --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"
supabase db push --dry-run
confirm "supabase db push"
supabase db push --password "$SUPABASE_DB_PASSWORD"
confirm "supabase config push (hook custom_access_token ; le diff affiché doit être lu, la CLI redemande)"
supabase config push --project-ref "$SUPABASE_PROJECT_REF"

# --- 3. secrets des fonctions ---------------------------------------------------
confirm "3. supabase secrets set (Stripe, Resend)"
# fichier temporaire (600) plutôt que la ligne de commande : les valeurs restent absentes de ps
secrets="$(mktemp)"; trap 'rm -f "$secrets"' EXIT
printf 'STRIPE_SECRET_KEY=%s\nSTRIPE_WEBHOOK_SECRET=%s\nRESEND_API_KEY=%s\nEMAIL_FROM=%s\n' \
  "$STRIPE_SECRET_KEY" "$STRIPE_WEBHOOK_SECRET" "$RESEND_API_KEY" "$EMAIL_FROM" >"$secrets"
supabase secrets set --env-file "$secrets" --project-ref "$SUPABASE_PROJECT_REF"
rm -f "$secrets"

# --- 4. fonctions ---------------------------------------------------------------
confirm "4. functions deploy"
for dir in supabase/functions/*/; do
  fn="$(basename "$dir")"
  [ "$fn" = "_shared" ] && continue
  [ -f "$dir/index.ts" ] || continue
  echo "   -> $fn"
  supabase functions deploy "$fn" --project-ref "$SUPABASE_PROJECT_REF"
done

# --- 5. données : tenant du site par défaut et son propriétaire -----------------
# Les autres sites ont chacun leur tenant : procédure « Ajouter un site » (docs/INSTANCES.md).
confirm "5. création du tenant et du propriétaire (TENANT_ID affiché en dernière ligne : à reporter dans config.ts du site)"
node scripts/seed-instance.mjs

# --- 6. sites et build ----------------------------------------------------------
echo "== 6. sites et build"
confirm "6. récupération des sites depuis R2, compilation, déploiement depuis cette machine"
scripts/r2-prive.sh sites "${sites[@]}"
for d in apps/vtc-websites/src/sites/*/; do
  n="$(basename "$d")"
  git ls-files -- "$d" | grep -q . && continue
  [[ " ${sites[*]} " == *" $n "* ]] || { echo "dossier de site hors liste : $n" >&2; exit 1; }
done
pnpm --filter @vtc/vtc-websites exec tsc --noEmit # astro build ne vérifie pas les types
export PUBLIC_SUPABASE_URL PUBLIC_SUPABASE_ANON_KEY PUBLIC_SITE_URL PUBLIC_SITE SITE_MAP="${SITE_MAP:-}"
pnpm --filter @vtc/vtc-backoffice --filter @vtc/vtc-websites build
npx wrangler@latest pages deploy apps/vtc-backoffice/dist --project-name="${PROJECT_PREFIX}-backoffice-production" --branch main
npx wrangler@latest pages deploy apps/vtc-websites/dist --project-name="${PROJECT_PREFIX}-drivers-front-production" --branch main

# --- 7. contrôle ----------------------------------------------------------------
echo "== 7. contrôle"
python3 scripts/check_migration_drift.py --ref "$SUPABASE_PROJECT_REF"
echo "Reste à faire : mettre à jour le registre (scripts/r2-prive.sh get registre/instances.md <hors dépôt>, édition, put)."
