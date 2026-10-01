---
phase: 14-routes-serveur-rpc-edge-functions
plan: 13
status: complete
---

# 14-13 — Réactivation des triggers de garde de `bookings`

## Analyse (2026-10-01, lecture seule)

Triggers désactivés en production : `trg_prevent_late_cancellation` (refuse un passage vers `cancelled_no_refund` ou
`cancelled_pending_refund` si `old.pickup_time <= now()`), `trg_prevent_pickup_time_change_after_paid` (refuse de changer
`pickup_time` si l'ancien statut est paid, completed, no_show, cancelled_pending_refund ou cancelled_refunded),
`trg_prevent_policy_update` (refuse de changer `cancellation_policy_id` une fois posé).

| Flux | Colonnes écrites sur `bookings` | Trigger concerné | Peut bloquer | Scénario |
|---|---|---|---|---|
| `cancel-booking` (service_role, `.eq("status","paid")`) | `status` = cancelled_no_refund, `cancellation_reason`, `cancelled_at` | late_cancellation | **oui** | annulation par l'admin d'une course payée après l'heure de prise en charge (no-show contesté) : « Cancellation failed » |
| `cancel-booking`, repli `catch` | `status` = refund_failed | aucun | non | |
| `create_refund`, `calculate-refund` | lecture seule | aucun | non | |
| `stripe_webhook` | INSERT d'une course payée (les UPDATE visent `stripe_events`) | aucun (triggers sur UPDATE) | non | |
| `accept-booking` | `driver_id`, `status` paid -> accepted, `mission_status` | aucun | non | |
| `generate-invoice`, `generate-devis` | `invoice_url`, `invoice_number`, `invoice_created_at` | aucun | non | |
| superadmin (`apps/superadmin/src`) | aucune écriture sur `bookings` | aucun | non | |
| RPC de la phase 14 | `update_booking_details` (`pickup_time` sur pending/accepted), `mark_booking_no_show` (`status`), `terrain_transition` | aucun | non | gardes déjà codées en dur dans les RPC |
| `trg_prevent_policy_update` | `cancellation_policy_id` n'est écrite par aucun flux | — | non | aucune course n'a de politique en production |

## Relevé production

- Annulations postérieures à la prise en charge : 0.
- Courses avec `cancellation_policy_id` : 0.
- Courses : 14 (completed 6, paid 4, accepted 2, no_show 1, pending 1). Aucune course annulée en production.

## Point de conception à trancher

`trg_prevent_late_cancellation` réactivé + `mark_booking_no_show` (qui refuse volontairement les courses payées, pour ne pas
court-circuiter le remboursement) = **une course payée par carte dont l'heure est passée n'a plus aucune issue** : ni annulation
(trigger), ni « non réalisée » (RPC). La transition `paid > no_show` existe pourtant. Réactiver ce trigger sans définir ce flux
(frais, remboursement partiel d'après la politique) créerait une impasse pour les paiements par carte.

## Recommandation

Option « partiel » : réactiver `trg_prevent_pickup_time_change_after_paid` et `trg_prevent_policy_update` (aucun flux bloqué),
garder `trg_prevent_late_cancellation` désactivé le temps de concevoir la « non réalisée » d'une course payée, et documenter
l'exception dans la règle 7 de `security_checks.sql`.

DECISION-TRIGGERS: partiel:trg_prevent_pickup_time_change_after_paid,trg_prevent_policy_update

Réponse de l'utilisateur (citation) : « pour le plan 13 ok go partiel ».

## Réalisation (2026-10-01)

- Migration `20261001190000_reenable_bookings_guard_triggers.sql` : `ENABLE TRIGGER` sur les deux triggers retenus, poussée en production (dry-run : cette seule migration).
- Production après push : `trg_prevent_pickup_time_change_after_paid` et `trg_prevent_policy_update` = `O` ; `trg_prevent_late_cancellation` = `D` (exception assumée) ; les 4 autres `O`.
- Lint : la règle 7 de `security_checks.sql` retire `trg_prevent_late_cancellation` de la liste exigée, avec commentaire ; à réintégrer dès sa réactivation.
- Suites SQL locales vertes (security, rls_role, 7 rpc).
- Suite à concevoir : « non réalisée » d'une course payée (frais, remboursement partiel d'après la politique), puis réactivation de `trg_prevent_late_cancellation`.
