---
phase: 14-routes-serveur-rpc-edge-functions
plan: 11
status: complete
---

# 14-11 — Code déployé et parcours vérifiés en production

## GO

Merge de la PR #13 : « go merge dans main, car je travail seul sur ce projet donc pas besoin de dev pour l'instant » (dev non mis à jour, `main` seul est utilisé : `dev` est 67 commits derrière et n'a rien d'unique).
Question tarif (`A-CONFIRMER-TARIF`, 0,5 €/min converti en 30 €/h) : l'utilisateur a demandé une explication ; le comportement actuel est conservé, une correction passerait par une migration dédiée.

## Déploiement

- PR #13 mergée (merge commit, CI verte : verify, schema-security, migration-drift), `build-and-deploy` vert.
- Contrôles HTTP en production : terrain-transition sans connexion 401 ; /rate backoffice 404 ; /rate websites (id inconnu) 404 ; submit-rating (id inconnu) « Réservation non trouvée ».
- Grep D-13 (`createAdminClient`, `SUPABASE_SERVICE_ROLE_KEY` dans le backoffice) : vide.

## Parcours vérifiés par l'utilisateur en production (2026-10-01)

- Création, modification, « En route », « Terminée » en cash : OK (course à 10 €, ligne `cash_completion` unique).
- « À bord » : n'existe pas dans l'interface (la RPC l'accepte, aucun bouton) ; hors périmètre.
- Bande « course en cours » : « c'est bon ».
- Annulation d'une course future : « c'est bon ».
- Notation par QR : « le qr code fonctionne » après agrandissement ; note 3 et commentaire enregistrés sur la course be985389.
- Paramètres (logo, forme juridique) : « c'est bon ».

## Écarts et ajouts (défauts trouvés par l'utilisateur, corrigés)

Voir ROADMAP, section « Livré hors plan » : PR #14 à #22 (connexion, modification et montant, heure de Paris, non réalisée, QR, page de notation, notes et historique, CI).

## Suite

14-12 (retrait de la clé Terraform, GO séparé) puis 14-13 (réactivation des 3 triggers après analyse des flux Stripe).
