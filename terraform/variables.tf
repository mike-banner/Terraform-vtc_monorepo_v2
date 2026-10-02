variable "cloudflare_api_token" {
  type        = string
  description = "Cloudflare API Token for provider"
  sensitive   = true
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare Account ID"
}

variable "environment" {
  type        = string
  description = "Deployment environment (e.g., production, staging)"
  default     = "dev"
}

# Secrets à injecter dans les 3 apps (Phase 2, 3, 4)
variable "supabase_url" {
  type        = string
  description = "URL publique du projet Supabase existant"
}

variable "supabase_anon_key" {
  type        = string
  description = "Clé anonyme Supabase"
  sensitive   = true
}

# Les trois variables suivantes ne sont plus injectées dans Cloudflare Pages
# (voir le commentaire de `backoffice_env_vars` dans main.tf). Elles restent
# déclarées parce que le workspace Terraform Cloud `vtc_prod` les définit encore :
# les retirer d'ici produirait un avertissement « value for undeclared variable ».
# À supprimer des deux côtés en même temps, le jour où on y touche.
variable "stripe_secret_key" {
  type        = string
  description = "Clé secrète Stripe"
  sensitive   = true
  default     = "sk_test_placeholder"
}

variable "stripe_webhook_secret" {
  type        = string
  description = "Secret Webhook Stripe"
  sensitive   = true
  default     = "whsec_placeholder"
}

variable "resend_api_key" {
  type        = string
  description = "Clé API Resend / Email"
  sensitive   = true
  default     = "re_placeholder"
}


variable "enable_superadmin" {
  type        = bool
  description = "Crée le projet superadmin (instance de la plateforme uniquement). Sans défaut : chaque workspace choisit."
}

variable "project_prefix" {
  type        = string
  default     = "vtc"
  description = "Préfixe neutre des projets Pages (code d'instance, jamais un nom de client)."

  validation {
    condition     = can(regex("^[a-z0-9-]{2,20}$", var.project_prefix))
    error_message = "project_prefix : 2 à 20 caractères parmi a-z, 0-9 et tiret."
  }
}
