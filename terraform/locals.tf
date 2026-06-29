locals {
  # Résolution automatique du site_url :
  # - Si var.site_url est défini (domaine personnalisé), on l'utilise tel quel.
  # - Sinon, on utilise le sous-domaine Cloudflare Pages calculé après le premier apply.
  # Pour un domaine custom, définir TF_VAR_site_url puis relancer terraform apply.
  # Voir terraform/DEPLOY.md pour les instructions complètes.
  resolved_site_url = var.site_url != "" ? var.site_url : "https://${cloudflare_pages_project.frontend.subdomain}"
}
