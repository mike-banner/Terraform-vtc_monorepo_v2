terraform {
  required_version = ">= 1.5.0"

  cloud {
    organization = "mike-banner_inc"

    workspaces {
      name = "vtc_prod"
    }
  }

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

locals {
  # Variables d'environnement Cloudflare Pages, lues au runtime par le SSR.
  # (Les variables de build — VITE_*/PUBLIC_* — viennent des secrets GitHub,
  # voir le step « Build applications » de .github/workflows/deploy.yml.)
  #
  # Moindre privilège : chaque projet ne reçoit que ce que son code lit
  # réellement. Auparavant les trois recevaient la même liste, donc les sites
  # vitrines publics avaient dans leur environnement la clé service_role, qui
  # contourne toute la RLS.
  base_env_vars = {
    PUBLIC_SUPABASE_URL      = var.supabase_url
    PUBLIC_SUPABASE_ANON_KEY = var.supabase_anon_key
    NODE_VERSION             = "20"
    PNPM_VERSION             = "9.0.0"
  }

  # Seule app à lire SUPABASE_SERVICE_ROLE_KEY (src/lib/supabase/server.ts).
  # STRIPE_*/RESEND_API_KEY ne sont lus par aucune des trois apps — ils servent
  # aux Edge Functions, qui ont leur propre configuration. Conservés ici par
  # prudence le temps de le confirmer côté Stripe ; à retirer ensuite.
  backoffice_env_vars = merge(local.base_env_vars, {
    SUPABASE_SERVICE_ROLE_KEY = var.supabase_service_role_key
    STRIPE_SECRET_KEY         = var.stripe_secret_key
    STRIPE_WEBHOOK_SECRET     = var.stripe_webhook_secret
    RESEND_API_KEY            = var.resend_api_key
  })
}

# Trigger CI/CD pipelines after Hard Reset

# Project ref Supabase (projet existant, pas de provider supabase) — dérivé de l'URL.
# deploy.sh le consomme via `terraform output -raw supabase_project_ref`.
output "supabase_project_ref" {
  value = trimsuffix(replace(var.supabase_url, "https://", ""), ".supabase.co")
}

# URL live du backoffice — affichée en fin de deploy.sh.
output "cloudflare_pages_subdomain" {
  value = "${cloudflare_pages_project.backoffice.name}.pages.dev"
}
