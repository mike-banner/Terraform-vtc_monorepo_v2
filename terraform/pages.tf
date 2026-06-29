# 1. Backoffice App
resource "cloudflare_pages_project" "backoffice" {
  account_id        = var.cloudflare_account_id
  name              = "vtc-backoffice-${var.environment}"
  production_branch = "main"



  deployment_configs {
    production {
      environment_variables = local.common_env_vars
      compatibility_flags   = ["nodejs_compat"]
    }
    preview {
      environment_variables = local.common_env_vars
      compatibility_flags   = ["nodejs_compat"]
    }
  }
}

# 2. Drivers Front App (Multi-Tenant via Cloudflare for SaaS)
resource "cloudflare_pages_project" "drivers_front" {
  account_id        = var.cloudflare_account_id
  name              = "vtc-drivers-front-${var.environment}"
  production_branch = "main"



  deployment_configs {
    production {
      environment_variables = local.common_env_vars
      compatibility_flags   = ["nodejs_compat"]
    }
    preview {
      environment_variables = local.common_env_vars
      compatibility_flags   = ["nodejs_compat"]
    }
  }
}

# 3. Superadmin App
resource "cloudflare_pages_project" "superadmin" {
  account_id        = var.cloudflare_account_id
  name              = "vtc-superadmin-${var.environment}"
  production_branch = "main"



  deployment_configs {
    production {
      environment_variables = local.common_env_vars
      compatibility_flags   = ["nodejs_compat"]
    }
    preview {
      environment_variables = local.common_env_vars
      compatibility_flags   = ["nodejs_compat"]
    }
  }
}
