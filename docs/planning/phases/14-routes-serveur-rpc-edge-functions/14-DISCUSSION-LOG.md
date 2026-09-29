# Phase 14: Routes serveur → RPC / Edge Functions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-29
**Phase:** 14-routes-serveur-rpc-edge-functions
**Areas discussed:** Calcul de prix, Transitions de course, Notation publique, Routes Astro et périmètre

---

## Calcul de prix

| Option | Description | Selected |
|--------|-------------|----------|
| Fonction SQL | `calculate_booking_price()` en PL/pgSQL, atomique, testable en CI | ✓ |
| Edge Function TypeScript | Réutilise `pricing.ts`, mais hors transaction et un appel HTTP en plus | |
| Vous décidez | Le planner choisit après recherche | |

**User's choice:** Fonction SQL
**Notes:** Le planner vérifie l'existence d'autres copies de la formule (websites, stripe_webhook).

| Option | Description | Selected |
|--------|-------------|----------|
| Garder tel quel | Montant manuel conservé, plafond et TVA recalculés dans la RPC | ✓ |
| Réservé owner/manager | Le driver ne crée qu'au tarif de la grille | |
| Supprimer | Toujours la grille | |

**User's choice:** Garder tel quel

---

## Transitions de course

| Option | Description | Selected |
|--------|-------------|----------|
| Supprimer | `update-booking-status` n'a aucun appelant dans le front | ✓ |
| Porter en RPC | `set_booking_status(id, status)` gardée par rôle | |

**User's choice:** Supprimer

| Option | Description | Selected |
|--------|-------------|----------|
| Une RPC par intention | `terrain_transition`, `driver_cancel_booking`, `update_booking_details` | ✓ |
| Une seule `transition_booking` | Un point d'entrée, gros switch interne | |

**User's choice:** Une RPC par intention

| Option | Description | Selected |
|--------|-------------|----------|
| driver = ses courses, owner/manager = tout le tenant | Reprend D-05/D-06 de la Phase 13 | ✓ |
| Tenant seulement (statu quo) | Laisse le trou D-05 ouvert | |

**User's choice:** driver = ses courses, owner/manager = tout le tenant

---

## Notation publique

| Option | Description | Selected |
|--------|-------------|----------|
| 2 RPC anon | `get_rating_context` + `submit_rating`, UUID = jeton | ✓ |
| Edge Function | `service_role` derrière un endpoint anonyme, rate-limit possible | |

**User's choice:** 2 RPC anon

| Option | Description | Selected |
|--------|-------------|----------|
| Déplacer maintenant | Page publique dans `vtc-websites`, backoffice sans page publique | ✓ |
| Laisser la page, changer l'accès | `rate/[id]` reste dans le backoffice, appelle les RPC anon | |

**User's choice:** Déplacer maintenant

---

## Routes Astro et périmètre

**User's input (texte libre):** « je veux passer en react pour le backoffice bientôt donc le point 4 on doit pas travailler pour tout refaire »
**Notes:** Traduit en D-01 : routes Astro = proxys minces (URL et contrat JSON inchangés), front non modifié.

| Option | Description | Selected |
|--------|-------------|----------|
| 2 RPC owner | `update_tenant_logo`, `update_tenant_settings`, TVA dérivée par trigger | ✓ |
| Policy UPDATE + grants par colonne | Validation d'URL du logo à déplacer en CHECK/trigger | |

**User's choice:** 2 RPC owner

| Option | Description | Selected |
|--------|-------------|----------|
| 1 RPC transactionnelle | `complete_tenant_setup`, colonnes explicites, tout ou rien | ✓ |
| Client utilisateur + RLS | Pas atomique, grants par colonne à ouvrir sur `tenants` | |
| Hors phase 14 | Bloque le retrait de `SUPABASE_SERVICE_ROLE_KEY` | |

**User's choice:** 1 RPC transactionnelle

| Option | Description | Selected |
|--------|-------------|----------|
| Step CI qui échoue | grep sur `createAdminClient` / `SUPABASE_SERVICE_ROLE_KEY` | ✓ |
| Suppression seule | Aucun contrôle automatique | |

**User's choice:** Step CI qui échoue

---

## Claude's Discretion

- Signatures, nommage, format d'erreur des RPC ; ordre de déploiement ; découpage des tests SQL par rôle.

## Deferred Ideas

- `api/auth/login` (Phase 17), Realtime/Web Push, droits fins `manager`, rate-limit de la notation publique.
