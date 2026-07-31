# Architecture Technique du Monorepo VTC

Ce document présente l'architecture logicielle et l'organisation des packages du projet **VTC Cloud Platform**.

---

## 🏗️ Structure des 3 Applications (`apps/`)

```text
apps/
├── vtc-backoffice/     # Dashboard SaaS Chauffeur & Gestion d'Agence (Astro SSR + React)
├── vtc-websites/       # Moteur de sites vitrines Multi-Tenant pour Chauffeurs & Groupements (Astro SSR Edge)
└── superadmin/         # Console de supervision globale de la plateforme SaaS (React SPA + Vite)
```

### 1. Dashboard SaaS Chauffeur (`apps/vtc-backoffice`)
* **Usage** : Gestion des réservations, facturation automatique Art. L441-3, comptabilité/ledger fiscal, paramétrage des grilles tarifaires et véhicules.
* **Technologie** : Astro SSR avec composants réactifs React, tailwindcss v4, Supabase Auth & Storage.

### 2. Moteur Vitrine Multi-Tenant (`apps/vtc-websites`)
* **Usage** : Hébergement dynamique de sites vitrines pour chauffeurs solos et groupements d'agences connectés.
* **Technologie** : Astro SSR déployé sur Cloudflare Pages Edge, résolution dynamique par domaine/sous-domaine (`resolveTenant`).
* **Fonctionnalités** : 4 Tunnels de réservation (`Transfert`, `Mise à disposition`, `Longue Distance`, `Business`), logos personnalisables via Supabase Storage.

### 3. Console Superadmin (`apps/superadmin`)
* **Usage** : Cockpit administrateur plateforme pour le suivi global des tenants, des abonnements et de la télémétrie.
* **Technologie** : React 19 + Vite SPA, TailwindCSS.

---

## 🔐 Isolation & Sécurité Multi-Tenant

* **Row Level Security (RLS)** : Toutes les requêtes PostgreSQL en base de données sont scopées par `tenant_id`.
* **Edge Functions Deno** : Génération asynchrone des devis/factures PDF et intégration des webhooks Stripe Connect.
* **Shared Types (`packages/database`)** : Définitions TypeScript auto-générées depuis la base Supabase pour garantir le typage de bout en bout.
