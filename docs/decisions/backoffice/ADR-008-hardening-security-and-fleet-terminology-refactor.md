# ADR-008: Sécurisation de l'infrastructure V1 & Refactoring de la terminologie Flotte

## Contexte
Afin de finaliser la V1 du SaaS VTC et d'assurer une étanchéité de sécurité et de conformité terminologique, nous avons mené deux chantiers majeurs :
1. Le durcissement de la sécurité des webhooks, de la facturation/paiement, des requêtes RPC et de la génération des codes QR.
2. Le remplacement intégral de la terminologie "flotte" par "véhicule" pour clarifier l'UX opérationnelle de la V1 mobile-first.

## Décisions

### 1. Durcissement Stripe (Checkout & Webhooks)
- **Recalcul côté serveur** : Le endpoint `create_checkout_session` calcule désormais les montants à la volée côté serveur, éliminant tout risque de falsification de prix par l'utilisateur.
- **Double vérification dans le Webhook** : Lors de la réception de la notification de paiement, le webhook de Stripe recalcule le montant total attendu et le valide contre la payload Stripe reçue.
- **Validation Tenant** : Le webhook valide l'existence du `tenant_id` en base de données avant toute insertion de réservation.
- **Sanitisation des Métadonnées** : Les adresses de prise en charge et de destination (`pickup_address` / `dropoff_address`) sont tronquées à 450 caractères pour éviter le dépassement de limite de Stripe.

### 2. Sécurité RPC & RLS
- **Validation Strict auth.uid()** : La RPC `delete_tenant_account` est protégée au niveau de la base de données en s'appuyant uniquement sur `auth.uid()` résolu côté serveur, garantissant que seuls les propriétaires légitimes peuvent initier une suppression.
- **Headers HTTP & CSP** : Configuration stricte des headers (`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`) déployée via `public/_headers`.

### 3. URLs Dynamiques de Notation (QR Codes)
- Remplacement des références codées en dur ou reposant uniquement sur `window.location.origin` par `import.meta.env.PUBLIC_SITE_URL` dans `RatingQRModal.tsx` et le service d'agenda. Cela garantit un ciblage HTTPS correct des avis Google.

### 4. Migration Terminologique "Flotte" → "Véhicule"
Pour simplifier l'expérience utilisateur de la V1 et éviter les termes trop abstraits, toutes les occurrences de "flotte" ont été réécrites en "véhicule" ou "partenaire" selon le contexte :
- `DriverModal.tsx` : "Ajouter un collaborateur à la flotte" → "Ajouter un collaborateur".
- `VehicleModal.tsx` : "Enregistrer un véhicule dans la flotte" → "Enregistrer un véhicule" ; "les autres véhicules de votre flotte" → "vos autres véhicules".
- `index.astro` : "Gestion de Flotte" → "Gestion des Véhicules".
- `tenants.astro` : "Partenaires & Flottes" → "Partenaires & Véhicules".
- `settings.astro` : "Appliqué aux flottes externes" → "Appliqué aux partenaires externes" ; Navigation "Gestion de Flotte" → "Gestion des Véhicules".
- `dashboard.astro` : Lien "Gérer la flotte" → "Gérer les véhicules".

## Statut
Accepté et implémenté — 2026-05-31
