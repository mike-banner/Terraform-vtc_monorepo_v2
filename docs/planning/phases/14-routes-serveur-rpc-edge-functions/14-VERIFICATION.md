---
phase: 14-routes-serveur-rpc-edge-functions
status: passed
verified: 2026-10-01
---

# Vérification de la phase 14

**But :** plus aucune logique métier ni clé `service_role` dans le serveur Astro du backoffice.

| Critère | Preuve |
|---|---|
| Aucun client admin ni clé dans le backoffice et le site | `git grep createAdminClient / SUPABASE_SERVICE_ROLE_KEY / service_role` sur `apps/vtc-backoffice` et `apps/vtc-websites` (hors `.md`) : 0 résultat ; garde CI D-13 dans `deploy.yml` |
| Écritures sensibles par RPC gardées par rôle | 12 fonctions en base (11 de la phase + `mark_booking_no_show`), identiques prod/local (empreintes md5, droits) ; 9 suites SQL en CI |
| Prix et TVA calculés côté serveur | `calculate_booking_price`, `booking_vat_split`, `create_manual_booking`, `update_booking_details` |
| Notation publique hors backoffice | `/rate/<id>` et `/api/submit-rating` dans `vtc-websites` ; note 3 enregistrée en production |
| Clé retirée de l'environnement Cloudflare du backoffice | Terraform appliqué le 2026-10-01 (PR #24) ; `terrain-transition` sans connexion = 401, login = 200 ; **suppression côté Cloudflare restante (voir ROADMAP)** |
| Parcours vérifiés en production par l'utilisateur | création, modification, en route, terminée en cash, annulation d'une course future (course 75112720 en `cancelled_no_refund`), non réalisée, QR, logo et forme juridique |
| Clé `service_role` tournée | confirmé par l'utilisateur ; journaux API sans 401/403/500 sur 3 h ; aucun appel d'Edge Function postérieur à la rotation observé |

Écarts assumés : `api/auth/login` renvoyé à la phase 17 ; `trg_prevent_late_cancellation` toujours désactivé (exception documentée) ; variables Cloudflare à supprimer à la main.
