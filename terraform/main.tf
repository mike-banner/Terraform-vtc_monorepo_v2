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
  # Ces variables seront injectées à la compilation par Cloudflare Pages
  common_env_vars = {
    PUBLIC_SUPABASE_URL      = var.supabase_url
    PUBLIC_SUPABASE_ANON_KEY = var.supabase_anon_key
    STRIPE_SECRET_KEY        = var.stripe_secret_key
    STRIPE_WEBHOOK_SECRET    = var.stripe_webhook_secret
    RESEND_API_KEY           = var.resend_api_key
    NODE_VERSION             = "20"
    PNPM_VERSION             = "9.0.0"
  }
}

# Trigger CI/CD pipelines after Hard Reset
