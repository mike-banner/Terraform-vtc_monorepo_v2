---
phase: 14-routes-serveur-rpc-edge-functions
plan: 10
status: complete
---

# 14-10 — Migrations de la phase en production

## GO

Réponse de l'utilisateur (citation littérale) : « go pousse les 1 et termine 11 a 13 » (après `/goal clear`, message séparé, 2026-10-01).

## Avant push (rejoué le 2026-10-01)

- Suites locales vertes après `supabase db reset --no-seed` : security_checks, rls_role_checks, 6 rpc_*_checks.
- Dry-run : exactement les 11 migrations 20260929110000 à 20260929110700.
- Prod : 13 transitions, 0 nom de RPC pris, md5 des 2 fonctions ledger = FUNCDEF-MD5 de 14-01.

## Push

`supabase db push --linked` : 11 migrations appliquées sans erreur.

## Après push

- 13 fonctions : md5, prosecdef et droits anon/authenticated identiques prod/local.
- Transitions : 14 (C1 : accepted>completed).
- security_checks en prod : exactement 3 violations (trg_prevent_late_cancellation, trg_prevent_pickup_time_change_after_paid, trg_prevent_policy_update désactivés), attendues jusqu'au plan 13.
- Advisors : nouveaux WARN limités aux RPC de la phase (anon : get_rating_context, submit_rating ; authenticated : 7 RPC). Autres lignes inchangées.
- Types régénérés depuis la prod : +18 lignes (booking_vat_split, calculate_booking_price). tsc backoffice et websites OK.
