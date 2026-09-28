# Phase 13: Rôles tenant dans la RLS - Context

**Gathered:** 2026-09-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Rendre vrais en base (RLS Postgres) les droits que `ROUTE_POLICY` (middleware Astro) fait respecter
aujourd'hui uniquement côté serveur. Plusieurs pages écrivent directement via le client Supabase
sans route API dédiée (`vehicles.astro`, `pricing.astro`) — pour ces écritures, la RLS est la SEULE
protection, pas une défense en profondeur. Le driver peut aujourd'hui modifier tarifs, véhicules et
chauffeurs, et modifier les courses d'un autre chauffeur, via un appel PostgREST direct.

Cette phase couvre : `current_tenant_role()`, la matrice rôle × table × opération, la réécriture des
policies par table et par commande, et la suite de tests SQL par rôle en CI. Les transitions de statut
de course formalisées en RPC (dispatch explicite, notifications) sont hors périmètre — c'est la Phase 14.

</domain>

<decisions>
## Implementation Decisions

### Rôle manager
- **D-01:** `manager` a exactement les mêmes droits que `owner` sur toutes les tables couvertes par
  cette phase (`vehicles`, `pricing_rules`, `drivers`, `financial_movements` en lecture), y compris la
  gestion de l'équipe de chauffeurs (`drivers` : INSERT/UPDATE/DELETE).
- **D-02:** `settings` et `setup` restent réservés à `owner` seul (déjà le cas dans `ROUTE_POLICY`,
  pas dans le périmètre RLS de cette phase — ce sont des pages, pas des tables).
- Contexte : le rôle `manager` est aujourd'hui inerte en exploitation (démarrage solo, voir
  `.planning/BACKLOG.md`). On ne le traite pas en cas à part (pas de deny explicite) : donner à `manager`
  les droits de `owner` partout ne coûte rien de plus (`IN ('owner','manager')` vs `= 'owner'`) et évite
  qu'un compte `manager` existant perde silencieusement tout accès.

### Bookings — lecture (SELECT)
- **D-03:** `driver` voit **toutes** les courses du tenant (pas de restriction à `driver_id`), pour
  pouvoir repérer les courses non assignées à prendre. Pas de changement par rapport à l'existant.
- **D-04:** `owner`/`manager` voient toutes les courses du tenant (inchangé).

### Bookings — écriture (UPDATE)
- **D-05:** `driver` restreint à `driver_id = lui` : ne peut modifier que ses propres courses.
- **D-06:** `owner`/`manager` gardent l'écriture large sur toutes les courses du tenant, **y compris
  la réassignation de `driver_id`** (dispatch manuel : owner/manager peut attribuer une course à un
  autre chauffeur si celui assigné ne peut pas la prendre).
- Ce découpage se fait **dès cette phase, via RLS** — pas d'attente de la RPC de dispatch de la Phase 14.
  La RPC formalisera ensuite la logique de dispatch (notification au nouveau chauffeur, etc.), mais la
  règle d'accès driver/owner-manager doit exister en base dès maintenant (le ROADMAP identifie
  explicitement ce trou : « un driver peut modifier les courses d'un autre »).
- Colonnes financières et statut : aucun calcul ni écriture financière côté client, quel que soit le
  rôle (règle projet, déjà couverte par `protect_booking_immutable_fields`).

### Table `drivers`
- **D-07:** `owner` et `manager` peuvent créer/modifier/désactiver un chauffeur (voir D-01).
- **D-08:** `driver` n'a pas de droit d'écriture sur `drivers` (ni sur sa propre fiche ni sur celle
  des autres).

### Ledger (`financial_movements`)
- **D-09:** Lecture réservée à `owner`/`manager`, cohérent avec `/app/ledger` déjà restreint dans
  `ROUTE_POLICY`. `driver` n'a accès à aucune ligne du ledger, y compris ses propres commissions.
  Écriture : déjà verrouillée en `service_role` uniquement depuis la Phase 12, hors périmètre ici.

### Table `customers`
- **D-10:** Même périmètre que `bookings` : `owner`/`manager`/`driver` peuvent lire/écrire les fiches
  clients. Le driver voit le client d'une course qu'il traite (nom, téléphone) — pas de restriction
  supplémentaire.

### Lecture `pricing_rules` et `vehicles`
- **D-11:** SELECT ouvert à tout le tenant (`owner`/`manager`/`driver`) — seule l'écriture reste
  réservée à `owner`/`manager` (D-01). Le driver doit pouvoir voir les grilles tarifaires et le
  véhicule qui lui est assigné.

### Claude's Discretion
- `cancellation_policies`, `zones`, `fixed_routes` : config utilisée aussi par le tunnel de réservation
  public (donc déjà lisible par `anon`/`authenticated` selon la Phase 12) — pas de nouvelle ambiguïté
  de rôle tenant identifiée ; le planner applique le principe général (lecture large au tenant, écriture
  owner/manager) sauf contre-indication trouvée en recherche.
- Détail syntaxique des policies (nommage, une policy par opération vs regroupement) — au planner/executor,
  du moment que `FOR ALL` disparaît et que les doublons sont supprimés (déjà dans les requirements ROADMAP).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Contexte et principe directeur
- `docs/decisions/vtc-backoffice/ADR-011-backoffice-react-spa-pwa-temps-reel.md` — Décision n°2 :
  "la sécurité descend en base avant toute bascule" ; rappelle le diagnostic du 2026-09-27 sur les
  policies actuelles (driver peut écrire tarifs/véhicules/chauffeurs via PostgREST direct).
- `.planning/ROADMAP.md` (section Phase 13) — Constats détaillés des policies en doublon et permissives
  actuelles, et liste des requirements déjà fixés (voir aussi le résumé dans `<domain>` ci-dessus).
- `.planning/BACKLOG.md` — Rôle `manager` aujourd'hui inerte en exploitation ; contexte pour D-01.

### Source de vérité des droits actuels (middleware, à répliquer en RLS)
- `apps/vtc-backoffice/src/lib/guards.ts` — `ROUTE_POLICY` : table de référence des droits par route,
  que la RLS doit maintenant faire respecter indépendamment du client appelant.
- `apps/vtc-backoffice/src/middleware.ts` (autour de la ligne 207) — Explique pourquoi `ROUTE_POLICY`
  a été appliqué au niveau middleware plutôt que page par page (trou API découvert), et pourquoi ça ne
  suffit pas (RLS reste le seul rempart pour les écritures directes Supabase côté pages `vehicles.astro`
  / `pricing.astro`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `current_tenant_id()` (fonction SQL existante) — modèle direct pour `current_tenant_role()`
  (STABLE, `SECURITY DEFINER`, `search_path` figé), déjà spécifié dans les requirements ROADMAP.

### Established Patterns
- `ROUTE_POLICY` dans `guards.ts` : `Record<string, TenantRole[]>` avec `ALL_TENANT_ROLES =
  ["owner", "manager", "driver"]`. Les pages `vehicles`/`pricing`/`ledger` sont `["owner", "manager"]`,
  `settings`/`setup` sont `["owner"]`, le reste (`dashboard`, `bookings`, `profile`) est ouvert aux
  trois rôles. Aucune route API n'existe pour `drivers` (gestion d'équipe), `vehicles`, `pricing` —
  ces pages écrivent en direct via le client Supabase, donc la RLS est le seul contrôle réel.
- `protect_booking_immutable_fields` (trigger existant, Phase 11) : empêche déjà l'écriture de colonnes
  financières côté client sur `bookings` — la Phase 13 n'a pas besoin de le reprendre, juste de ne pas
  le casser en réécrivant les policies UPDATE.

### Integration Points
- Les nouvelles policies RLS remplacent la protection implicite que `ROUTE_POLICY` fournissait pour les
  écritures directes (vehicles, pricing, drivers). `ROUTE_POLICY` reste en place pour la navigation UX
  (redirections de page), mais ne sera plus la seule barrière de sécurité une fois cette phase terminée
  (cf. dernier requirement du ROADMAP : "Une fois la RLS en place, ROUTE_POLICY ne sert plus qu'à la
  navigation").

</code_context>

<specifics>
## Specific Ideas

- Le driver doit pouvoir repérer les courses non assignées du tenant (lecture large maintenue) — c'est
  la raison explicite de garder le SELECT ouvert plutôt que de le restreindre à `driver_id`.
- Le dispatch manuel (owner/manager réassigne une course à un autre chauffeur si celui prévu ne peut
  pas la prendre) doit rester possible dès cette phase, pas seulement après la RPC de la Phase 14.

</specifics>

<deferred>
## Deferred Ideas

- RPC de dispatch formalisée (notification au chauffeur réassigné, historique des réassignations) —
  Phase 14, cette phase ne fait que poser la règle d'accès en RLS.
- Droits fins du rôle `manager` au-delà de la parité avec `owner` (ex. un manager qui ne pourrait pas
  tout faire) — non demandé, `manager` reste sous-utilisé ; suivi dans `.planning/BACKLOG.md`.

</deferred>

---

*Phase: 13-r-les-tenant-dans-la-rls*
*Context gathered: 2026-09-29*
