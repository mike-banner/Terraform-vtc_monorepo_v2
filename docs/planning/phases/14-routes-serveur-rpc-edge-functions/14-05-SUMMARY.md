---
phase: 14-routes-serveur-rpc-edge-functions
plan: 05
subsystem: database
tags: [supabase, rpc, pricing, vat, lint]
requires: [14-01, 14-02, 14-03, 14-04]
provides:
  - public.update_booking_details(uuid, timestamptz, text, text, numeric, numeric) RETURNS numeric
  - public.create_manual_booking(...) RETURNS TABLE(booking_id uuid, total_price numeric)
  - supabase/lint/rpc_booking_edit_checks.sql
key-files:
  created:
    - supabase/migrations/20260929110500_rpc_update_booking_details.sql
    - supabase/migrations/20260929110510_rpc_create_manual_booking.sql
    - supabase/lint/rpc_booking_edit_checks.sql
decisions:
  - DECISION-EDIT A appliquée : statuts modifiables pending et accepted, prix manuel conservé, HT/TVA recalculés
metrics:
  tasks: 2
  completed: 2026-10-01
requirements: [P14-R2, P14-R3]
---

# Phase 14 Plan 05 : RPC de modification et de création manuelle de course

`update_booking_details` recalcule prix (`calculate_booking_price`, sauf course à prix manuel) et HT/TVA
(`booking_vat_split`, TVA du tenant lue en base), refuse les statuts payés et au-delà dans la RPC elle-même
(trigger de garde désactivé en prod), pose puis remet à vide le marqueur `vtc.trusted_rpc`.
`create_manual_booking` crée client, prix, TVA et course dans une transaction ; owner/manager uniquement, fiche
`drivers` requise, véhicule vérifié contre le tenant, montant manuel borné à ]0 ; 9999] et tracé `pricing_mode='manual'`.

## Commits
- 4977e13 test(db): matrice update_booking_details (RED : fonction absente)
- ea37302 feat(db): RPC update_booking_details avec recalcul serveur du prix et de la TVA
- 4a0a9e3 fix(db): un seul marqueur de décision dans update_booking_details
- bc1289b test(db): matrice create_manual_booking (RED : fonction absente)
- 03a8a92 feat(db): RPC create_manual_booking transactionnelle, prix serveur

## Vérifications
- `supabase db reset --no-seed` puis `security_checks`, `rls_role_checks` et les quatre `rpc_*_checks` : code 0.
- Critères grep conformes (DECISION-EDIT: = 1 lettre A, pas de cancellation_policy_id, DISABLE TRIGGER = 1,
  v.tenant_id = v_tenant, pas de trusted_rpc dans la création, v_total > 9999 = 1, 0 mention interdite).

## Deviations from Plan
- Mineure : le commentaire inline de la migration d'édition répétait `DECISION-EDIT: A` (compte 2 au lieu de 1) ;
  reformulé dans un commit de correction (4a0a9e3).
- Mineure : dans la suite, les valeurs « avant » (policy, pickup de b4) sont conservées via tables temporaires
  plutôt que `\gset` (l'interpolation psql échouait) ; aucun écart de comportement.
- `STATE.md` / `ROADMAP.md` non mis à jour via gsd-tools (`.planning` est un symlink Vault, consigne du lancement).

## Known Stubs
Aucun.

## Self-Check: PASSED
