# VTC Cloud Platform — Multi-Tenant SaaS Architecture

> A production-ready, highly scalable multi-tenant platform built for the transportation industry, showcasing modern architectural patterns, Infrastructure as Code (IaC), and GitOps CI/CD workflows.

---

## 🏗️ Architecture Overview

This project is structured as a **Monorepo** to decouple concerns while maximizing code reuse across multiple frontend applications and a centralized backend.

### The Stack
- **Frontend Layer**: [Astro](https://astro.build/) (Hybrid SSR/SSG), TailwindCSS.
- **Backend Layer**: [Supabase](https://supabase.com/) (PostgreSQL, Row Level Security, Edge Functions).
- **Infrastructure Layer**: [Terraform](https://www.terraform.io/) (HCP Terraform Backend), Cloudflare Pages.
- **CI/CD Pipeline**: GitHub Actions (GitOps).

### Key Engineering Highlights

#### 1. Multi-Tenant Edge Architecture (Cloudflare for SaaS)
Instead of provisioning separate instances for each driver or agency, the `drivers-front` application acts as a single multi-tenant SSR server deployed on Cloudflare Pages. It dynamically renders tailored interfaces based on custom hostnames (via Cloudflare for SaaS API), drastically reducing infrastructure overhead and deployment times.

#### 2. Fully Automated GitOps Pipeline
Infrastructure changes are strictly peer-reviewed and deployed via GitHub Actions:
- **Pull Requests**: Trigger `terraform plan` to validate and preview infrastructure drift securely.
- **Merges to `dev`/`main`**: Automatically execute `terraform apply`, provisioning Cloudflare Pages instances and injecting production secrets at build time.

#### 3. Centralized Infrastructure as Code (IaC)
All cloud resources are codified in the `terraform/` directory. The state is securely managed via HashiCorp Cloud Platform (HCP), preventing deployment conflicts via state locking and providing a full audit trail of architectural changes.

#### 4. Type-Safe Monorepo
Leveraging `pnpm` workspaces, the architecture shares a single `packages/database` module containing Supabase generated TypeScript definitions. This ensures end-to-end type safety from the PostgreSQL schema down to the UI components.

---

## 📂 Project Structure

```text
vtc_repo_v2/
├── apps/
│   ├── backoffice/     # Agency management dashboard (Astro)
│   ├── drivers-front/  # Multi-tenant public-facing sites for drivers (Astro)
│   └── superadmin/     # Platform administration console (Astro)
├── packages/
│   └── database/       # Shared TS types and Supabase client logic
├── supabase/
│   ├── migrations/     # Version-controlled PostgreSQL schemas
│   ├── seed.sql        # Deterministic local development data
│   └── config.toml     # Supabase local environment configuration
├── terraform/            
│   ├── main.tf         # Providers and HCP Backend configuration
│   ├── pages.tf        # Cloudflare Pages deployment definitions
│   └── variables.tf    # Environment-agnostic variable definitions
└── .github/workflows/
    └── terraform.yml   # GitOps CI/CD pipeline
```

---

## 🚀 Deployment & Operations

### Prerequisites
- Node.js 20+ & `pnpm` 9+
- Terraform CLI ≥ 1.5.0
- Supabase CLI

### Local Development Setup

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Start the local Supabase stack**
   ```bash
   supabase start
   ```

3. **Run the development servers**
   ```bash
   pnpm dev --filter backoffice
   ```

### Infrastructure Deployment (CI/CD)

The infrastructure is fully automated. Pushing to `dev` or `main` will trigger the GitHub Actions workflow, which securely handles:
- Cloudflare Pages provisioning for the 3 frontend apps.
- Secure injection of third-party credentials (Stripe, Resend, Supabase).
- Automatic builds and distributed CDN edge deployments.

For manual infrastructure emergency overrides:
```bash
cd terraform/
terraform init
terraform plan
terraform apply
```

---

## 🔐 Security Standards

- **Row Level Security (RLS)**: PostgreSQL policies isolate tenant data at the database layer.
- **Secret Management**: No secrets are stored in the repository. They are injected at pipeline execution via GitHub Secrets.
- **Principle of Least Privilege**: Cloudflare API tokens and Terraform service accounts are restricted solely to the resources they govern.
