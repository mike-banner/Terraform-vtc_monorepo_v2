# 1. Backoffice App
resource "cloudflare_pages_project" "backoffice" {
  account_id        = var.cloudflare_account_id
  name              = "${var.project_prefix}-backoffice-${var.environment}"
  production_branch = "main"



  deployment_configs {
    production {
      environment_variables = local.backoffice_env_vars
      compatibility_flags   = ["nodejs_compat"]
    }
    preview {
      environment_variables = local.backoffice_env_vars
      compatibility_flags   = ["nodejs_compat"]
    }
  }
}

# 2. Drivers Front App (Multi-Tenant via Cloudflare for SaaS)
resource "cloudflare_pages_project" "drivers_front" {
  account_id        = var.cloudflare_account_id
  name              = "${var.project_prefix}-drivers-front-${var.environment}"
  production_branch = "main"



  deployment_configs {
    production {
      environment_variables = local.base_env_vars
      compatibility_flags   = ["nodejs_compat"]
    }
    preview {
      environment_variables = local.base_env_vars
      compatibility_flags   = ["nodejs_compat"]
    }
  }
}

# 3. Superadmin App
moved {
  from = cloudflare_pages_project.superadmin
  to   = cloudflare_pages_project.superadmin[0]
}

resource "cloudflare_pages_project" "superadmin" {
  count             = var.enable_superadmin ? 1 : 0
  account_id        = var.cloudflare_account_id
  name              = "${var.project_prefix}-superadmin-${var.environment}"
  production_branch = "main"



  deployment_configs {
    production {
      environment_variables = local.base_env_vars
      compatibility_flags   = ["nodejs_compat"]
    }
    preview {
      environment_variables = local.base_env_vars
      compatibility_flags   = ["nodejs_compat"]
    }
  }
}
