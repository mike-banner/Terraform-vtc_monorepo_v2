# Phase 6: Câblage Dynamique des Tunnels (Drivers Front)

Ce plan détaille l'intégration des données réelles issues de Supabase (configurées par le chauffeur dans le Backoffice) vers les différents tunnels de réservation du Drivers Front. 
L'objectif est de conserver 100% du design (les maquettes visuelles existantes dans `src/components/tunnels/`) tout en branchant la vraie donnée de Supabase (véhicules, transferts, tarifs, paiement).

## Découpage par Sous-Phases (Validation itérative avec Playwright)

### [DONE] Hotfix: Refonte Modale Pricing Backoffice
- **Action :** Séparation visuelle (UX) des tarifs "Trajet A-B" et "Mise à disposition" dans `pricing.astro` sans altérer la base de données. Rendu des champs optionnels pour plus de flexibilité.
- **Statut :** Complété en "capture" (entre deux tâches).

### [DONE] 6.1: Tunnel Transfert (TransfertTunnel.astro)
- **Cible :** `apps/drivers-front/src/components/tunnels/TransfertTunnel.astro`
- **Données :** Récupérer la table `fixed_routes` jointe avec `zones` (pour les gares/aéroports) et `get_available_vehicles()`.
- **Action :** 
  - [x] Refonte UX : Conversion en tunnel JS Step-by-Step, remplacement des cartes par un `<select>` + Toggle "Sens du trajet".
  - [x] Validation d'adresse : Injection de contraintes géographiques (Regex CP 75 pour Paris).
  - [x] Remplacer les listes statiques par les vraies données de `fixed_routes` et `get_available_vehicles()`.
  - [x] Intégrer la logique client-side (`<script>`) pour appeler `create_checkout_session` (Stripe).
- **Validation :** Test Playwright E2E "Jusqu'à Stripe" en cours.

### 6.2: Tunnel Longue Distance (LongDistanceTunnel.astro)
- **Cible :** `apps/drivers-front/src/components/tunnels/LongDistanceTunnel.astro`
- **Données :** Récupérer le tarif au Km via `pricing_rules` et les véhicules via `get_available_vehicles()`.
- **Action :** 
  - Refonte UX en tunnel Step-by-Step (JS).
  - Remplacer les destinations prédéfinies et véhicules par les vraies données.
  - **[OPTION A - Actif en V1]** Villes populaires avec distance fixée en dur pour calcul rapide (`Prix = Distance * Tarif KM`). Les adresses personnalisées tombent en "Sur devis".
  - **[OPTION B - Inactif]** Préparation du code pour brancher l'API Google Maps Distance Matrix (mise en attente pour éviter les coûts d'API V1).
  - Brancher le Checkout (soumission du formulaire).
  - *Note : L'adaptation de la fonction Edge `create_checkout_session` pour le prix dynamique est documentée dans le `PLAN-X-STRIPE-DYNAMIC.md`.*
- **Validation :** Test E2E Playwright de la création d'une course kilométrique.

### 6.3: Tunnel Excursions & Mise à Disposition (AvailabilityTunnel.astro)
- **Cible :** `apps/drivers-front/src/components/tunnels/AvailabilityTunnel.astro`
- **Données :** `pricing_rules` (`price_per_hour`, `minimum_fare`).
- **Action :** 
  - Positionnement B2C (Familles, touristes, expéditions type Versailles).
  - Refonte Step-by-step avec calcul dynamique horaire.
  - Mise en avant de l'itinéraire et ajout d'options "Traducteur" et "Formule Tour Operator".
  - *À prévoir plus tard : Base de données de parcours dédiés (Tours).*
- **Validation :** Test Playwright d'une réservation avec options touristiques.

### 6.4: Tunnel B2B / Attente Fixe (BusinessTunnel.astro)
- **Cible :** `apps/drivers-front/src/components/tunnels/BusinessTunnel.astro`
- **Données :** `pricing_rules` (`price_per_hour`).
- **Action :** 
  - Positionnement B2B (Salons, RDV d'affaires, attente point fixe).
  - Refonte Step-by-Step avec calcul dynamique (Forfait Heure ou Forfait Journée `8h x Tarif`).
  - Suppression de l'itinéraire au profit d'un champ "Lieu du salon / Point d'attente".
  - Intégration du formulaire entreprise (SIRET, TVA).
- **Validation :** Vérification de l'interface et de la facturation dynamique B2B.

## Règles de développement
1. **Design Préservé :** Interdiction de modifier les classes Tailwind ou la structure HTML des maquettes, sauf pour injecter les variables `{donnee}`.
2. **Qualité :** Chaque sous-phase ne commence que si la précédente passe les tests Playwright avec succès.
