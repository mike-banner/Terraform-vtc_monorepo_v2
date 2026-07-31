# ADR-003: Double table de statuts et Ledger Immuable

## Contexte
Le cycle de vie d'une course comprend des statuts financiers (paiement Stripe, remboursement) et des statuts opérationnels terrain (chauffeur en route, client à bord). Mélanger ces états crée des bugs complexes.

## Décision
- Séparation des responsabilités en base de données sur la table `bookings` :
  - `status` : Gère le cycle financier (`pending`, `paid`, `cancelled_refunded`, etc.).
  - `mission_status` : Gère le cycle de livraison terrain (`to_validate`, `not_started`, `in_progress`, `completed`).
- Remplacement des tables d'annulations et commissions éparpillées par une table unique immuable `financial_movements` (Ledger comptable) servant d'audit financier.

## Statut
Accepté et implémenté.
