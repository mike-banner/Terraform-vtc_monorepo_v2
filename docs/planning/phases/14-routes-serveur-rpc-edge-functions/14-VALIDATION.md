---
phase: 14
slug: routes-serveur-rpc-edge-functions
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-30
---

# Phase 14 — Validation Strategy

> Contrat de validation par phase. Les suites SQL sont livrées par les plans eux-mêmes (le chercheur en
> prévoyait une seule, `rpc_role_checks.sql` ; les plans la scindent en six fichiers `rpc_*_checks.sql`).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | SQL pur via `psql` (`\set ON_ERROR_STOP`, transaction annulée) ; `tsc --noEmit` ; `astro build` ; grep CI |
| **Config file** | `.github/workflows/db-lint.yml`, `supabase/lint/*.sql` |
| **Quick run command** | `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/lint/<suite du plan>.sql` (sans reset) |
| **Full suite command** | `supabase db reset --no-seed` puis `security_checks.sql`, `rls_role_checks.sql` et les six `rpc_*_checks.sql` ; `pnpm --filter @vtc/vtc-backoffice exec tsc --noEmit` ; `pnpm --filter @vtc/vtc-websites exec tsc --noEmit` ; `pnpm --filter @vtc/vtc-websites build` |
| **Estimated runtime** | ~60 s (reset) + ~30 s (suites) |

---

## Sampling Rate

- **After every task commit:** suite `rpc_*_checks.sql` du plan en cours, sans reset (< 30 s)
- **After every plan wave:** suite complète ci-dessus
- **Before `/gsd-verify-work`:** suite complète verte + contrôles prod du plan 14-10 rejoués
- **Max feedback latency:** 90 s

---

## Per-Plan Verification Map

| Plan | Lot | Requirement | Comportement sécurisé | Suite / commande | Statut |
|------|-----|-------------|-----------------------|------------------|--------|
| 14-01 | socle | P14-R2, R3 | relevé prod lecture seule, décisions CASH/EDIT/ARRONDI tracées | requêtes SQL lecture seule (manuel, accès prod) | ⬜ |
| 14-02 | socle | P14-R2 | seed 13 transitions ; marqueur `vtc.trusted_rpc` non forgeable par authenticated/anon | `rpc_socle_checks.sql` + `security_checks.sql` règles 7-10 | ⬜ |
| 14-03 | socle | P14-R3 | prix et TVA calculés côté serveur, parité avec `lib/pricing.ts` | `rpc_pricing_checks.sql` | ⬜ |
| 14-04 | rpc-bookings | P14-R2 | `terrain_transition`, `driver_cancel_booking` gardées par rôle, idempotentes, triggers désactivés inclus | `rpc_bookings_checks.sql` | ⬜ |
| 14-05 | rpc-bookings | P14-R2, R3 | `update_booking_details`, `create_manual_booking` | `rpc_booking_edit_checks.sql` | ⬜ |
| 14-06 | rpc-tenant | P14-R1 | `update_tenant_logo`, `update_tenant_settings`, `complete_tenant_setup` | `rpc_tenant_checks.sql` | ⬜ |
| 14-07 | rating | P14-R4 | RPC de notation anon, page et route vtc-websites | `rpc_rating_checks.sql` ; `pnpm --filter @vtc/vtc-websites build` ; grep couleurs | ⬜ |
| 14-08 | proxys | P14-R1, R2, R3 | proxys de course sans `createAdminClient` | `tsc --noEmit` backoffice | ⬜ |
| 14-09 | proxys | P14-R1, R6 | plus de `createAdminClient` / `SUPABASE_SERVICE_ROLE_KEY` dans `apps/vtc-backoffice` | `! git grep -nE 'createAdminClient\|SUPABASE_SERVICE_ROLE_KEY' -- apps/vtc-backoffice` (hors `*.md`) | ⬜ |
| 14-10 | prod | P14-R1, R4 | migrations en prod après GO, équivalence md5 prod/local | requêtes MCP lecture seule + `supabase migration list --linked` | ⬜ |
| 14-11 | prod | P14-R1, R4 | parcours vérifiés en prod après déploiement du code | manuel (accès prod, navigateur) | ⬜ |
| 14-12 | terraform | P14-R6 | clé retirée de Terraform, CI, workspaces TFC | `terraform plan` + grep repo | ⬜ |
| 14-13 | fix | P14-R2 | 3 triggers réactivés après analyse des flux | `security_checks.sql` (triggers `tgenabled='O'`) | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/lint/rpc_socle_checks.sql` — seed, marqueur, test de forge (plan 14-02)
- [ ] `supabase/lint/rpc_pricing_checks.sql` — vecteurs de prix partagés avec `lib/pricing.ts` (plan 14-03)
- [ ] `supabase/lint/rpc_bookings_checks.sql`, `rpc_booking_edit_checks.sql`, `rpc_tenant_checks.sql`, `rpc_rating_checks.sql`
- [ ] extension de `security_checks.sql` : table de transitions non vide, triggers `bookings` actifs, allowlist DEFINER anon
- [ ] steps dans `db-lint.yml` : suites `rpc_*` et grep D-13

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Parcours de notation depuis le lien QR | P14-R4 | navigateur et domaine réel | ouvrir le lien généré, noter, vérifier la ligne `booking_ratings` |
| Contrôles de production (triggers, transitions, RPC présentes) | P14-R1, R2 | accès prod, pas de fixtures en prod | requêtes SQL lecture seule des plans 14-01, 14-10 |
| Parcours terrain, annulation, création manuelle en prod | P14-R1, R2, R3 | session réelle d'un driver/owner | checklist du plan 14-11 |

---

## Validation Sign-Off

- [ ] Tous les plans ont un `<automated>` ou une dépendance Wave 0
- [ ] Pas de 3 tâches consécutives sans vérification automatisée
- [ ] Wave 0 couvre toutes les références manquantes
- [ ] Pas de mode watch
- [ ] Latence de feedback < 90 s
- [x] `nyquist_compliant: true` posé en frontmatter

**Approval:** pending
