# VTC Cloud Platform — Multi-Tenant SaaS & Multi-Site Ecosystem

> **Plateforme SaaS B2B & Moteur de Sites Vitrines Multi-Tenants pour Chauffeurs Indépendants et Agences VTC.**  
> Architecture Monorepo moderne, SSR Edge, Facturation Légale automatisée (Art. L441-3) et GitOps IaC.

---

## ⚡ En Un Coup d'Œil 

| Axe du Projet | Stack Principale | Rôle Métier / Utilité Produit |
| :--- | :--- | :--- |
| 🏢 **`apps/vtc-backoffice`** | Astro SSR, React 19, Tailwind v4, Supabase | **Dashboard SaaS Chauffeur & Agence** : Gestion des courses, tarification par zone, comptabilité/ledger fiscal, facturation PDF. |
| 🚗 **`apps/vtc-websites`** | Astro SSR Edge, Cloudflare Pages, Supabase RLS | **Moteur Multi-Site Vitrine** : Génération dynamique de sites vitrines sur-mesure pour chauffeurs solos et groupements/agences connectés (logos Supabase Storage, 4 tunnels de réservation). |
| 🛡️ **`apps/superadmin`** | React + Vite SPA, TailwindCSS | **Console Admin Plateforme** : Superviseur global des tenants, des abonnements et de la télémétrie SaaS. |
| 📦 **`packages/database`** | TypeScript, Supabase CLI | **Types Partagés** : Auto-génération des types TypeScript PostgreSQL pour un typage 100% strict du backend aux UIs. |

---

## 🛠️ Stack Technique Globale

- **Frontend & Edge** : Astro (SSR Edge Mode), React 19, TailwindCSS v4, DaisyUI, Glassmorphic Design System.
- **Backend & Data** : Supabase (PostgreSQL, Row Level Security isolation tenant, Edge Functions Deno, Realtime).
- **Infrastructures & Cloud** : Cloudflare Pages, Terraform IaC (HCP Backend), GitHub Actions (CI/CD GitOps).
- **Services & Intégrations** : Stripe Connect (Paiements/Webhooks), Resend (Emails transactionnels PDF), API Géolocalisation.

---

## 🌟 Points Forts d'Ingénierie & Architecture

### 1. Multi-Tenancy & Multi-Sites Vitrines (`apps/vtc-websites`)
- **Résolution d'hôte dynamique (`resolveTenant`)** : Une seule instance SSR Cloudflare Pages sert une infinité de sites vitrines personnalisés (ex: `elite-lyon.fr`, `vtc-prestige-paris.fr`).
- **Branding Sur-Mesure** : Chargement automatique des logos depuis Supabase Storage (`tenant.logo_url`), du nom de société et des grilles tarifaires spécifiques à chaque chauffeur ou groupement d'agences.
- **4 Tunnels de Réservation Connectés** : Transfert A ➔ B, Mise à disposition horaire, Longue Distance interurbaine, et Devis Business VIP.

### 2. Confort Métier & Conformité Légale (`apps/vtc-backoffice`)
- **Facturation Légale Automatisée** : Séquençage strict des numéros de factures (`FAC-YYYY-xxxx`) conforme à l'article L441-3 du Code de Commerce.
- **Génération PDF & Webhooks** : Edge Functions Deno pour l'édition de proformas/factures PDF et synchronisation temps réel avec Stripe Connect.

### 3. Pipeline GitOps & IaC Complètement Automatisé
- **Terraform (HCP Backend)** : Tout l'infrastructure Cloudflare Pages est définie sous forme de code dans `terraform/`.
- **CI/CD GitHub Actions** : `terraform plan` automatique sur chaque PR et `terraform apply` au merge sur `dev`/`main`.

---

## 📂 Navigation dans la Documentation (`/docs`)

- 📐 [docs/ARCHITECTURE.md](file:///home/mike/projects/vtc/vtc_repo_v2/docs/ARCHITECTURE.md) : Découpage technique du Monorepo & isolation Supabase RLS.
- 🚗 [docs/MULTI_TENANCY_WEBSITES.md](file:///home/mike/projects/vtc/vtc_repo_v2/docs/MULTI_TENANCY_WEBSITES.md) : Fonctionnement détaillé des sites vitrines multi-tenants pour chauffeurs & groupements.
- 💳 [docs/BILLING.md](file:///home/mike/projects/vtc/vtc_repo_v2/docs/BILLING.md) : Flux de facturation, webhooks Stripe Connect & exports comptables.

---

## 🚀 Démarrage Rapide (Développement Local)

```bash
# 1. Installation des dépendances du monorepo
pnpm install

# 2. Lancement du stack local Supabase
supabase start

# 3. Lancement des serveurs de dev
pnpm dev
```
