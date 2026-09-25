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
  #
  # STRIPE_*/RESEND_API_KEY ne sont volontairement plus injectés ici. Le paiement
  # et l'e-mail ne s'exécutent pas sur Cloudflare : le backoffice se contente
  # d'appeler des Edge Functions (`supabase.functions.invoke`), et ce sont elles
  # qui lisent les clés via `Deno.env`, depuis les secrets du projet Supabase —
  # vérifiés présents le 2026-09-25. Une copie ici n'était lue par personne et
  # faisait croire qu'une rotation de clé côté Terraform suffisait.
  backoffice_env_vars = merge(local.base_env_vars, {
    SUPABASE_SERVICE_ROLE_KEY = var.supabase_service_role_key
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
