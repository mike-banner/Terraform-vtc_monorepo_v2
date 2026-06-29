# Plan de Migration & Standardisation VTC-MVP (v2)

Ce document détaille la stratégie pour fusionner le travail d'infrastructure réalisé dans `saas-starter-template` (Terraform, Supabase, Billing) vers ce monorepo `vtc_repo_v2`, et planifier l'intégration des futures fonctionnalités métiers.

---

## 1. Gestion de la Base de Données (Réponse à ta question)

**"Dois-je m'assurer que la base en ligne soit le miroir de mes migrations ?"**

**OUI, absolument.** L'approche "Infrastructure as Code" exige que ton dossier `supabase/migrations/` soit la **seule source de vérité**.
Si ta base Supabase de production (ou dev en ligne) a déjà des tables qui ne sont pas dans tes fichiers `.sql` locaux, le prochain `terraform apply` ou `supabase db push` va échouer (ou pire, casser des choses).

**La bonne approche pour repartir sur des bases saines :**
1. **Option A (Si tu as des données en ligne à garder) :**
   Lance `supabase db pull` pour récupérer le schéma exact qui est actuellement en ligne et le convertir en un fichier de migration initial dans ton projet. Ensuite, applique les nouveautés de l'auth/billing par-dessus.
2. **Option B (Recommandée si tu peux repartir à zéro pour VTC v2) :**
   Détruis le projet Supabase de test actuel. Utilise le `saas-starter-template` pour tout recréer proprement. Tes fichiers de migrations locaux recréeront la structure de A à Z.

---

## 2. Plan d'Intégration du `saas-starter-template`

Pour injecter le pipeline d'infrastructure robuste dans ce monorepo, voici les étapes :

1. **Copie des fondations :**
   - Copier le dossier `terraform/` (avec `deploy.sh`, `main.tf`, `variables.tf`, etc.).
   - Copier le dossier `supabase/` (incluant les migrations initiales d'Auth/Billing et la Edge Function Stripe).
2. **Adaptation du `deploy.sh` :**
   - Ajuster le script pour qu'il prenne en compte le format Monorepo (Turborepo), notamment si le frontend a besoin d'être buildé spécifiquement ou si les variables d'environnement (`.env`) doivent être injectées dans `apps/backoffice` et `apps/drivers-front`.
3. **Fusion des schémas de DB :**
   - Créer une nouvelle migration `supabase/migrations/00000000000001_vtc_core.sql`.
   - Y ajouter tes tables VTC spécifiques (`rides`, `vehicles`, `drivers`, etc.) tout en les liant à la table `public.profiles` issue du starter.

---

## 3. Roadmap des Nouvelles Fonctionnalités (Mobile-First Web App)

Puisque ton application est **mobile-first**, ces ajouts vont nécessiter des interactions fluides et légères côté frontend (Astro/Nuxt), et des API robustes côté Supabase :

* **Amélioration de Stripe / Facturation :**
  - **Devis & Facturation Électronique :** Étendre le webhook actuel pour générer des factures PDF ou stocker les devis dans Supabase avant validation.
  - **Gestion des flux complexes :** Séparer les paiements (ex: commission plateforme vs paiement chauffeur via Stripe Connect si nécessaire plus tard).
* **Emails Transactionnels :**
  - Configurer Resend, Postmark ou SendGrid via les Edge Functions Supabase (ou des Webhooks de base de données) pour envoyer les reçus, confirmations de courses et devis.
* **Géolocalisation (Crucial pour VTC) :**
  - Utiliser PostGIS dans Supabase (extension native de PostgreSQL) pour gérer des requêtes spatiales ultra-rapides (ex: trouver les chauffeurs dans un rayon de X km).
  - Écouter les positions GPS du mobile via le frontend Web App et les envoyer à intervalles réguliers à Supabase.

---

## 4. Prochaines Actions

Quand tu seras prêt à travailler dans ce dossier, l'ordre de bataille idéal est le suivant :

1. Nettoyer les schémas de base de données existants (choisir Option A ou B).
2. Coller le dossier `terraform/` et le tester à vide.
3. Importer les Edge Functions et tester le webhook Stripe en local.
4. Développer l'extension PostGIS pour la géolocalisation.
