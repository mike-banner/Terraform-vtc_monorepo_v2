# 🚗 VTC HUB — Vitrine Multi-Tenant & Tunnel de Réservation

Plateforme de réservation et d'exposition de services VTC "Shopify-like" permettant à des chauffeurs privés d'héberger et d'exploiter leur propre site web de réservation depuis une seule base de code.

---

## 🎯 Points Forts & Architecture Technique

Cette vitrine a été conçue pour offrir des performances web maximales, une sécurité robuste et une isolation totale des données des chauffeurs.

### 1. Architecture Multi-Tenant Dynamique
- **Résolution Host-Header** : Le middleware résout à la volée l'identité du chauffeur (tenant) à partir du nom de domaine (CNAME personnalisé).
- **Isolation de Données** : Isolation stricte garantie au niveau de la base de données PostgreSQL via des filtres applicatifs et des politiques d'isolation par chauffeur (`tenant_id`).

### 2. Découplage strict Front/Back (Sécurité Stripe)
- **Sécurité Financière** : Aucun calcul de prix final ou de commission n'est exposé côté client. Le frontend interagit avec des **Edge Functions** backend.
- **Cycle Stripe** : Le frontend génère une session Stripe Checkout sécurisée en passant par le backoffice. La confirmation finale et les emails d'expédition de course sont entièrement pilotés via des webhooks Stripe sur le serveur.

### 3. SEO Local Predictif & Performance Edge
- **Optimisation SEO** : Génération de landing pages ciblées par ville avec des données de contenu injectées dynamiquement.
- **Données Structurées** : Injection automatisée de métadonnées Schema.org (`LocalBusiness` / `TaxiService`) et de balises OpenGraph uniques.
- **Lighthouse > 90** : Temps de chargement optimisé via le moteur d'images d'Astro 5 et une gestion asynchrone des ressources tiers.

---

## 🛠️ Stack Technique

- **Framework** : [Astro 5.x](https://astro.build/) (Static & SSR Hybrid)
- **Langage** : [TypeScript](https://www.typescriptlang.org/) (Typage strict, Zod validation)
- **Composants** : [React](https://react.dev/) (pour l'interactivité dynamique du tunnel de réservation)
- **Styling** : [Tailwind CSS v4](https://tailwindcss.com/) & [daisyUI v5](https://daisyui.com/)
- **Backend / DB** : [Supabase](https://supabase.com/) (SDK JS + Edge Functions)
- **Paiements** : [Stripe Checkout](https://stripe.com/)

---

## 📂 Organisation du Codebase

- `src/pages/` : Routage des pages d'atterrissage, de paiement et de routage dynamique des villes (`[...path].astro`).
- `src/components/tunnels/` : Logique des formulaires de commande pas-à-pas (ex: `BookingTransfertTunnel.astro`).
- `src/core/` : Services transverses (client Supabase, résolveur de tenant).
- `docs/` : Spécifications et invariants d'ingénierie :
  - [`docs/RULES.md`](file:///home/mike/projects/vtc/vtc-drivers/docs/RULES.md) : Les invariants et règles de sécurité.
  - [`docs/BUSINESS_FLOWS.md`](file:///home/mike/projects/vtc/vtc-drivers/docs/BUSINESS_FLOWS.md) : Diagrammes de séquence des réservations.
  - [`docs/SEO.md`](file:///home/mike/projects/vtc/vtc-drivers/docs/SEO.md) : Standards SEO et exigences techniques.
  - [`docs/SUPABASE.md`](file:///home/mike/projects/vtc/vtc-drivers/docs/SUPABASE.md) : Schéma multi-tenant et rôles RLS.
  - [`docs/adr/`](file:///home/mike/projects/vtc/vtc-drivers/docs/adr/README.md) : Historique des décisions d'architecture (ADR).

---

## ⚙️ Commandes de Développement

```bash
# Installation des dépendances
npm install

# Démarrage du serveur de développement local
npm run dev

# Construction du bundle de production optimisé
npm run build

# Preview locale de la version build
npm run preview
```
