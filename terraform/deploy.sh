#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# deploy.sh — Pipeline de déploiement complet (INFRA-02)
# Usage : ./deploy.sh [--auto-approve]
# Voir terraform/DEPLOY.md pour le runbook complet.
# =============================================================================

# --- 1. PRÉFLIGHT : binaires ------------------------------------------------
echo "🔎 Vérification des prérequis..."

if ! command -v terraform &>/dev/null; then
  echo "❌ terraform non trouvé. Installez-le : https://developer.hashicorp.com/terraform/install" >&2
  exit 1
fi

if ! command -v supabase &>/dev/null; then
  echo "❌ supabase CLI non trouvé. Installez-le : https://supabase.com/docs/guides/cli" >&2
  exit 1
fi

# --- 2. PRÉFLIGHT : variables d'environnement --------------------------------
MISSING_VARS=()
for VAR in \
  TF_CLOUD_ORGANIZATION \
  TF_WORKSPACE \
  SUPABASE_ACCESS_TOKEN \
  TF_VAR_supabase_access_token \
  TF_VAR_cloudflare_api_token \
  TF_VAR_supabase_db_password; do
  if [ -z "${!VAR:-}" ]; then
    MISSING_VARS+=("$VAR")
  fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo "❌ Variables d'environnement manquantes (ne jamais afficher leur valeur) :" >&2
  for VAR in "${MISSING_VARS[@]}"; do
    echo "   - $VAR" >&2
  done
  echo "Consultez terraform/DEPLOY.md pour la liste complète." >&2
  exit 1
fi

echo "✅ Prérequis OK"

# --- 3. Terraform init -------------------------------------------------------
echo ""
echo "🚀 Initialisation de Terraform..."
terraform init -input=false

# --- 4. Format + validate ----------------------------------------------------
echo ""
echo "🧹 Vérification du formatage Terraform..."
terraform fmt -check -recursive

echo "✅ Validation de la syntaxe Terraform..."
terraform validate

# --- 5. Terraform apply ------------------------------------------------------
echo ""
APPLY_FLAGS="-input=false"
if [ "${1:-}" = "--auto-approve" ]; then
  # ponytail: opt-in explicite — ne pas mettre -auto-approve par défaut (déploiement payant)
  APPLY_FLAGS="$APPLY_FLAGS -auto-approve"
  echo "⚡ Mode non-interactif activé (--auto-approve)"
fi

echo "🏗️  Application Terraform (infra réelle — déploiement payant)..."
# shellcheck disable=SC2086
terraform apply $APPLY_FLAGS

# --- 6. Récupérer le project ref ---------------------------------------------
echo ""
echo "🔗 Récupération du project ref Supabase..."
PROJECT_REF="$(terraform output -raw supabase_project_ref)"
if [ -z "$PROJECT_REF" ]; then
  echo "❌ terraform output supabase_project_ref est vide — apply a-t-il réussi ?" >&2
  exit 1
fi
echo "   Project ref : $PROJECT_REF"

# --- 7. Supabase link --------------------------------------------------------
echo ""
echo "🔗 Liaison au projet Supabase..."
supabase link --project-ref "$PROJECT_REF" --password "$TF_VAR_supabase_db_password"

# --- 8. Migrations -----------------------------------------------------------
echo ""
echo "🗄️  Déploiement des migrations (supabase db push)..."
supabase db push

# --- 9. Edge function --------------------------------------------------------
echo ""
echo "⚡ Déploiement de la edge function stripe-webhook..."
supabase functions deploy stripe-webhook --project-ref "$PROJECT_REF"

# --- 10. Message final -------------------------------------------------------
echo ""
SUBDOMAIN="$(terraform output -raw cloudflare_pages_subdomain 2>/dev/null || true)"
if [ -n "$SUBDOMAIN" ]; then
  echo "🎉 Déploiement terminé ! Site disponible sur : https://$SUBDOMAIN"
else
  echo "🎉 Déploiement terminé !"
fi
echo ""
echo "Pour un domaine personnalisé, voir terraform/DEPLOY.md (pattern double-apply)."
