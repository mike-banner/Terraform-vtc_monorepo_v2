# ADR-004: Durcissement de la Base de Données et Sécurité Financière V1

## Contexte
Afin d'éviter toute manipulation frauduleuse des tarifs, double paiement ou corruption de la comptabilité, la base de données doit être auto-défensive.

## Décisions

### 1. Immuabilité des Champs Critiques du Booking
Dès qu'une réservation passe en statut autre que `pending`, un trigger SQL interdit la modification des champs suivants :
- `total_amount`
- `pickup_address`
- `dropoff_address`
- `pickup_time`
- `payment_mode`

### 2. Unicité de la Commission
- La table `commissions` possède un index d'unicité sur `booking_id` pour garantir qu'aucune course ne puisse générer plus d'une commission pour la plateforme.

### 3. Protection Anti-Concurrence (Délégation/Partage)
- Un index partiel unique sur `bookings.driver_id` empêche la double acceptation simultanée d'une course déléguée.
- Limite stricte à un seul partage/cercle par booking pour bloquer tout comportement de marketplace complexe en V1.

## Statut
Accepté et implémenté.
