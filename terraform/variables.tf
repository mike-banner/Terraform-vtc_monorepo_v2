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
