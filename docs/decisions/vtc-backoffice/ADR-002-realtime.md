# ADR-002: Realtime vs API Standard pour les Transitions de Mission

## Contexte
Les chauffeurs sur le terrain doivent signaler leur statut ("En route", "Client à bord", "Terminé"). Ces transitions doivent être fiables et enregistrées précisément avec des contraintes de temps.

## Décision
- Les transitions d'état opérationnelles s'effectuent via un appel API HTTP POST (`/api/missions/terrain-transition`) plutôt que directement via des écritures Realtime Supabase côté client.
- Cela permet de centraliser la logique métier côté serveur (vérification de la garde H-15 pour le pickup, logs horodatés dans `mission_note`).
- Supabase Realtime Channels est uniquement utilisé pour la mise à jour visuelle (lecture seule) de l'UI.

## Statut
Accepté et implémenté.
