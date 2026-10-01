# Phase 13: Rôles tenant dans la RLS - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-29
**Phase:** 13-r-les-tenant-dans-la-rls
**Areas discussed:** Droits manager vs owner, Visibilité des courses par le driver, Écriture des courses par le driver, Gestion de la table drivers, Ledger, Customers, Lecture tarifs/véhicules

---

## Droits manager vs owner

| Option | Description | Selected |
|--------|-------------|----------|
| Copier ROUTE_POLICY à l'identique | Manager = owner sur vehicles/pricing/ledger, settings/setup owner seul | ✓ |
| Manager plus restreint | Le manager perd des droits qu'il semble avoir aujourd'hui côté UI | |

**User's choice:** Copier ROUTE_POLICY à l'identique.
**Notes:** L'utilisateur a ensuite fait remarquer que le rôle `manager` a peut-être été introduit trop tôt
(owner+driver aurait suffi pour une V1). Discussion : comme `manager` existe déjà comme valeur du type
`TenantRole` et dans `ROUTE_POLICY`, le traiter à part (deny explicite) coûte plus cher que de lui donner
la parité avec `owner`. L'utilisateur a confirmé garder la parité manager=owner partout, y compris sur
`drivers`. Le point "manager sous-utilisé" est noté dans `.planning/BACKLOG.md`, pas dans cette phase.

---

## Visibilité des courses par le driver

| Option | Description | Selected |
|--------|-------------|----------|
| Driver voit tout le tenant | SELECT reste ouvert, permet de voir les courses non assignées | ✓ |
| Driver limité à ses courses | RLS SELECT restreinte à driver_id | |

**User's choice:** Driver voit tout le tenant (garder l'existant).
**Notes:** Aucune.

---

## Écriture des courses par le driver

**Question initiale :** restreindre le driver à ses courses dès la Phase 13, ou attendre la RPC de la Phase 14 ?

**Clarification demandée par l'utilisateur :** "c'est quoi les RPC déjà ? je veux qu'il soit restreints à
eux et que le owner ou manager puisse attribuer des courses en dispatch si un autre chauffeur ou lui ne
peut pas."

**Réponse apportée :** explication de ce qu'est une RPC (fonction Postgres `SECURITY DEFINER` appelée via
`supabase.rpc(...)`, encapsule une logique plus fine que RLS seule, prévue en Phase 14 pour les transitions
de statut). Reformulation de la règle : driver restreint à `driver_id = lui`, owner/manager gardent
l'écriture large (dispatch inclus).

| Option | Description | Selected |
|--------|-------------|----------|
| Restreindre dès la Phase 13 | RLS UPDATE distingue driver (driver_id=lui) et owner/manager (tout le tenant, dispatch inclus) | ✓ |
| Attendre la RPC de dispatch (Phase 14) | La règle d'accès arrive avec la RPC | |

**User's choice:** Dès la Phase 13, via RLS.
**Notes:** Le dispatch manuel (réassignation de `driver_id` par owner/manager) doit rester possible dès
cette phase — voir D-06 dans CONTEXT.md.

---

## Gestion de la table drivers

**Question initiale :** owner seul, ou owner+manager comme véhicules/tarifs ?

**Clarification demandée par l'utilisateur :** "owner/manager oui mais manager peut être très peu utilisé
je l'ai mis en avance peut-être un peu trop tôt car owner et driver suffisait pour une version 1 je pense."

**Réponse apportée :** argument technique (deny explicite pour manager coûterait plus cher qu'une parité
avec owner, et un compte manager existant perdrait silencieusement tout accès) + rappel que le sujet
"manager sous-utilisé" est déjà backlogué. Recommandation : garder manager=owner partout, y compris drivers.

| Option | Description | Selected |
|--------|-------------|----------|
| Owner + manager | Cohérent avec véhicules/tarifs | ✓ |
| Owner seul | Traité comme une décision structurelle | |

**User's choice:** Owner + manager (confirmé après clarification).
**Notes:** Voir D-01 et D-07 dans CONTEXT.md.

---

## Ledger (financial_movements)

| Option | Description | Selected |
|--------|-------------|----------|
| Owner+manager seulement | Cohérent avec /app/ledger déjà restreint | ✓ |
| Driver voit ses propres mouvements | Lecture de ses commissions | |

**User's choice:** Owner+manager seulement.
**Notes:** Aucune.

---

## Table customers

| Option | Description | Selected |
|--------|-------------|----------|
| Owner+manager+driver, comme bookings | Le driver voit le client d'une course qu'il traite | ✓ |
| Owner+manager seulement | Driver ne voit pas les fiches clients | |

**User's choice:** Owner+manager+driver, comme les courses.
**Notes:** Aucune.

---

## Lecture pricing_rules et vehicles

| Option | Description | Selected |
|--------|-------------|----------|
| Driver peut lire (SELECT ouvert au tenant) | Cohérent avec le principe lecture large / écriture restreinte | ✓ |
| Driver n'a pas besoin de lire | SELECT aussi réservé owner/manager | |

**User's choice:** Driver peut lire.
**Notes:** Aucune.

---

## Claude's Discretion

- `cancellation_policies`, `zones`, `fixed_routes` : pas de nouvelle ambiguïté de rôle identifiée,
  appliquer le principe général (lecture large, écriture owner/manager).
- Détail syntaxique des policies (nommage, regroupement) — au planner/executor.

## Deferred Ideas

- RPC de dispatch formalisée (notifications, historique) — Phase 14.
- Droits fins du rôle manager au-delà de la parité avec owner — non demandé, suivi dans BACKLOG.md.
