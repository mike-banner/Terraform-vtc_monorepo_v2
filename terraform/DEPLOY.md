# Déploiement Terraform

Le déploiement d'une instance (Terraform, Supabase, fonctions, sites) est décrit dans [`docs/INSTANCES.md`](../docs/INSTANCES.md).

Terraform ne contient aucun nom d'organisation ni de workspace : `TF_CLOUD_ORGANIZATION` et `TF_WORKSPACE` les fournissent.
`enable_superadmin` n'a pas de valeur par défaut : chaque workspace la choisit (`true` pour l'instance de la plateforme,
`false` chez un client).

Attention : la fusion sur `main` applique Terraform sur `vtc_prod` (`.github/workflows/terraform.yml`, `apply -auto-approve`).
