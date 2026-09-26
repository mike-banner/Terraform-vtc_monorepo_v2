# Plan X : Adaptation Stripe pour Tarification Dynamique (VTC V2)

Ce plan documente les futures modifications à apporter à la fonction Edge Supabase `create_checkout_session` (ou au backend Stripe) pour supporter les **trajets longue distance et mises à disposition** (tarification dynamique).

## Constat Actuel (V1)
La fonction `create_checkout_session` a été conçue principalement pour les transferts (forfaits fixes). Elle prend un `fixed_route_id` et va chercher le prix de cette route dans la base de données de Supabase.

Pour un trajet Longue Distance, le prix n'est pas lié à une route fixe, mais il est **calculé dynamiquement** à la volée : `Prix = max(seuil, base + (distance_km * tarif_km))`.

## Ce qu'il faudra changer (Backend)

### 1. Modification du Payload d'entrée de la Fonction
La fonction `create_checkout_session` devra accepter de nouveaux paramètres dans `booking_data` :
- `type` : `'fixed'` | `'long_distance'` | `'hourly'`
- `distance_km` : Le nombre de kilomètres calculé (uniquement si `long_distance`).
- `duration_hours` : Le nombre d'heures (uniquement si `hourly`).

### 2. Validation Sécurisée du Prix Côté Serveur (Edge Function)
Pour des raisons de sécurité, on ne doit JAMAIS faire confiance au prix envoyé par le frontend.
La fonction devra recalculer le prix elle-même :
1. Si `type === 'fixed'` : Récupérer le prix via `fixed_route_id`.
2. Si `type === 'long_distance'` : 
   - Vérifier dans `pricing_rules` le tarif au km de la `vehicle_category` demandée.
   - Calculer : `montant = pricing.base_price + (distance_km * pricing.price_per_km)`.
   - Appliquer la condition : `if (montant < pricing.minimum_fare) montant = pricing.minimum_fare`.
3. Créer le `line_items` Stripe avec ce `montant` généré dynamiquement.

### 3. Gestion du statut "Sur Devis"
Si aucune API cartographique n'est capable de calculer la distance exacte (ou que la destination saisie est personnalisée), on ne redirigera pas le client vers Stripe. Le payload créera simplement un enregistrement de réservation en base de données avec le statut `pending_quote` (Sur Devis).

## Ce qu'il faudra changer (Frontend)

- Lors de l'appel à la fonction Supabase, au lieu de passer un `fixed_route_id`, on passera la `distance_km` (calculée via Google Maps).
- Afficher un message distinct si le calcul est impossible : "Votre demande a bien été envoyée et nécessite un devis de notre part. Nous vous contacterons."

> **Raison du report :** Cette implémentation nécessite le câblage de l'API Google Maps Distance Matrix. Pour éviter des frais d'API inutiles en Phase 1 de test, les requêtes hors villes prédéfinies passeront en "Sur Devis" pour l'instant.
