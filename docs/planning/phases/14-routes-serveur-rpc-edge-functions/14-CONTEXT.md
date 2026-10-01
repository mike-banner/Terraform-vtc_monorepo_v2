# Phase 14: Routes serveur → RPC / Edge Functions - Context

**Gathered:** 2026-09-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Plus aucune logique métier ni clé `service_role` dans le serveur Astro du backoffice. Chaque écriture qui passe
aujourd'hui par `createAdminClient()` (bypass RLS) devient une RPC Postgres gardée par rôle, appelée avec la
session de l'utilisateur. La clé `SUPABASE_SERVICE_ROLE_KEY` est retirée de `backoffice_env_vars` (Terraform)
en fin de phase.

**Contrainte transverse (décision utilisateur, 2026-09-29) :** le backoffice passe bientôt en React (ADR-011,
Phase 17). On ne refait pas les routes Astro : elles restent des proxys minces, l'effort va dans les RPC, qui
serviront telles quelles à la SPA.

Cette phase ne couvre PAS : Realtime/Web Push (phases suivantes), la conversion React, ni `api/auth/login`.

</domain>

<decisions>
## Implementation Decisions

### Périmètre et forme des routes Astro
- **D-01:** Les routes et pages Astro concernées gardent leur **URL et leur contrat JSON**. Seul l'intérieur
  change : `locals.supabase` (session utilisateur) + `.rpc(...)`, plus aucun `createAdminClient`. Les scripts
  front (`scripts/bookings.ts`, `scripts/app-layout.ts`, `dashboard.astro`) ne sont **pas** modifiés. Ces routes
  disparaissent avec la SPA en Phase 17 : aucune refonte.
- **D-02:** Inventaire réel (les 10 fichiers du ROADMAP) : `api/tenant/{booking-actions, create-booking,
  update-booking-status, update-logo, update-settings}`, `api/missions/terrain-transition`, `api/submit-rating`,
  `pages/rate/[id].astro`, `pages/app/setup.astro`, `lib/supabase/server.ts`. Les autres routes `api/tenant/*`
  (`bookings`, `export-csv`, `export-fec`, `search-bookings`) utilisent déjà la session utilisateur : inchangées.
  Il y en a 9 au total, pas 8 comme écrit dans le ROADMAP.

### Calcul de prix
- **D-03:** La formule (distance/heure, règle tarifaire, TVA TTC→HT) vit dans une **fonction SQL unique**
  (`calculate_booking_price` ou équivalent), appelée en interne par les RPC de création et de modification.
  Elle remplace `calculatePrice` / `computeVat` / `findPricingRule` de `lib/pricing.ts` pour les écritures.
  Testée dans la suite SQL de la CI. Le planner vérifie si `vtc-websites` / `stripe_webhook` ont leur propre
  copie de la formule et évite la divergence.
- **D-04:** `create-booking` : le montant manuel (`manual_total`) est **conservé** tel quel. Plafond 9999 € et TVA
  recalculés côté serveur dans la RPC, `pricing_mode = 'manual'` tracé. Le chauffeur connecté doit avoir une
  fiche `drivers` (comportement actuel). La création (client, TVA tenant, prix, insertion) est **une seule
  RPC transactionnelle**.

### Transitions de course
- **D-05:** `api/tenant/update-booking-status` est **supprimée** (aucun appelant dans le front ; acceptait un
  statut libre en `service_role`), ainsi que sa ligne dans `ROUTE_POLICY`. Pas de RPC de remplacement.
- **D-06:** **Une RPC par intention**, pas de RPC fourre-tout : `terrain_transition(booking_id, action,
  corrected_at)` (en_route / on_board / completed), `driver_cancel_booking(booking_id, reason)`,
  `update_booking_details(booking_id, ...)` (modification pré-mission avec recalcul de prix, D-03). Les
  signatures exactes sont au planner.
- **D-07:** Garde de rôle : `driver` n'agit que sur **ses** courses (`driver_id`), `owner`/`manager` sur toutes
  celles du tenant (reprend D-05/D-06 de la Phase 13). Sinon erreur `42501`. Les transitions rejouées
  (marqueur `[terrain]` déjà posé) restent **idempotentes** et renvoient succès. La règle H-15 (ADR-002)
  est conservée dans la RPC ; elle s'appuie sur `trg_validate_booking_status_transition`.
- **D-08:** `mission_status` ne change plus que via ces RPC. La règle « Interdits » de
  `apps/vtc-backoffice/CLAUDE.md` (« seule route autorisée : `/api/missions/terrain-transition` ») est mise à
  jour en conséquence, ainsi que la ligne de la table « Fichiers cœur ».

### Notation publique (sans session)
- **D-09:** Deux **RPC appelables par `anon`** : `get_rating_context(booking_id)` (renvoie seulement nom, logo,
  URL avis Google du tenant + déjà-noté ; plus de `select('*')` sur la course) et `submit_rating(booking_id,
  rating, comment)` (course terminée, non encore notée, note 1–5, commentaire tronqué à 500). L'UUID de course
  reste le jeton d'accès (comme aujourd'hui). `REVOKE EXECUTE ... FROM PUBLIC` puis `GRANT EXECUTE ... TO anon`
  explicite (un `REVOKE` ciblé sur `anon` ne retire pas le droit hérité de `PUBLIC`).
- **D-10:** `rate/[id]` et `submit-rating` sont **déplacés vers `vtc-websites`** (clé anon seulement). Le QR de
  `RatingQRModal` et `bookings.ts` pointent vers la nouvelle URL. Le backoffice n'a plus aucune page publique.
  Les liens existants sont éphémères (affichés en fin de course). La résolution de l'URL/domaine côté websites
  est à établir par la recherche.

### Paramètres tenant et onboarding
- **D-11:** `update-logo` et `update-settings` passent par **deux RPC réservées à `owner`** (D-02 Phase 13) :
  `update_tenant_logo(url)` conserve la validation du préfixe du bucket public `assets` ;
  `update_tenant_settings(legal_form, vat_number)` laisse `trg_sync_tenant_vat` dériver `is_vat_exempt` et
  `vat_rate` (le `vat_rate = 10` codé en dur dans la route disparaît).
- **D-12:** `setup.astro` : le POST devient **une RPC transactionnelle** `complete_tenant_setup(legal, vehicle,
  pricing)` : `owner` seul, `setup_completed = false` requis, colonnes écrites listées explicitement (ferme le
  mass assignment actuel : `.update({...tenantData})` avec le corps brut du client, en `service_role`),
  tout ou rien. La page ne change que son POST.

### Fin de phase
- **D-13:** `SUPABASE_SERVICE_ROLE_KEY` retiré de `backoffice_env_vars` (Terraform), `lib/supabase/server.ts`
  supprimé, et un **step CI** (grep, sur le modèle des règles de lint SQL de la Phase 13) échoue si
  `createAdminClient` ou `SUPABASE_SERVICE_ROLE_KEY` réapparaît dans `apps/vtc-backoffice`. Le retrait en
  production exige un GO explicite (Terraform, hors merge).

### Claude's Discretion
- Signatures, nommage et format des erreurs des RPC (au planner), du moment que `42501` signale un refus de rôle.
- Ordre de déploiement : migrations (RPC) avant le code des routes, retrait de la clé en dernier. Le planner
  découpe en plans livrables séparément ; la mise en production suit le schéma de la Phase 13 (plan dédié + GO).
- Tests : une suite SQL par rôle pour chaque RPC (owner / manager / driver propre course / driver autre course /
  autre tenant / anon), intégrée à `db-lint.yml`, sur le modèle de `rls_role_checks.sql`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Principe directeur et contraintes
- `docs/decisions/vtc-backoffice/ADR-011-backoffice-react-spa-pwa-temps-reel.md` — décision n°2 : les écritures
  sensibles passent par des RPC `SECURITY DEFINER` à contrôle de rôle ; `service_role` ne quitte jamais le serveur ;
  migration React par étapes (justifie D-01).
- `docs/decisions/vtc-backoffice/ADR-002-realtime.md` — transitions terrain centralisées côté serveur, garde H-15.
- `docs/planning/phases/13-r-les-tenant-dans-la-rls/13-CONTEXT.md` — D-02, D-05, D-06 (droits par rôle) repris ici.
- `docs/planning/phases/13-r-les-tenant-dans-la-rls/13-VERIFICATION.md` — limite documentée de `ROUTE_POLICY` que
  cette phase referme.
- `.planning/ROADMAP.md` (section Phase 14) — requirements et inventaire de départ.
- `apps/vtc-backoffice/CLAUDE.md` — règles « Interdits » à mettre à jour (D-08), conventions DB.

### Code à porter (lire avant de toucher)
- `apps/vtc-backoffice/src/pages/api/tenant/booking-actions.ts` — annulation chauffeur + modification avec recalcul.
- `apps/vtc-backoffice/src/pages/api/tenant/create-booking.ts` — création manuelle, prix, TVA, montant manuel.
- `apps/vtc-backoffice/src/pages/api/missions/terrain-transition.ts` — transitions terrain, H-15, marqueurs `[terrain]`.
- `apps/vtc-backoffice/src/pages/api/tenant/update-logo.ts`, `update-settings.ts` — écritures `tenants`.
- `apps/vtc-backoffice/src/pages/app/setup.astro` (POST, l. 24-97) — onboarding en `service_role`.
- `apps/vtc-backoffice/src/pages/api/submit-rating.ts`, `src/pages/rate/[id].astro`,
  `src/components/dashboard/RatingQRModal.tsx` — notation publique et génération du lien.
- `apps/vtc-backoffice/src/lib/pricing.ts` — formule à porter en SQL (D-03).
- `apps/vtc-backoffice/src/lib/guards.ts` — `ROUTE_POLICY` (retirer `update-booking-status`).
- `apps/vtc-backoffice/src/lib/supabase/server.ts` — `createAdminClient`, à supprimer (D-13).

### Base de données
- `supabase/migrations/20260929100200_bookings_client_update_columns.sql` — grants UPDATE par colonne sur `bookings`
  (les RPC `SECURITY DEFINER` doivent écrire ce que les grants interdisent au client).
- `supabase/migrations/20260929100300_reenable_bookings_triggers.sql` — triggers de garde `bookings`.
- `supabase/migrations/20260926003805_restore_tenant_legal_fields_and_vat_sync.sql` — `trg_sync_tenant_vat`.
- `supabase/migrations/20260317225903_approve_onboarding_add_driver.sql` — `approve_onboarding_tx`, modèle de RPC d'onboarding.
- `supabase/lint/rls_role_checks.sql`, `.github/workflows/db-lint.yml` — modèle des tests SQL par rôle en CI.

### Infra
- Terraform `backoffice_env_vars` — variable `SUPABASE_SERVICE_ROLE_KEY` à retirer (D-13).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `current_tenant_id()` et `current_tenant_role()` (Phase 13) : gardes de rôle à réutiliser dans chaque RPC.
- `approve_onboarding_tx()` : modèle de RPC transactionnelle d'onboarding pour `complete_tenant_setup`.
- `protect_booking_immutable_fields` + grants par colonne : le client ne peut pas écrire montants/statut ; les RPC
  `SECURITY DEFINER` sont le seul chemin d'écriture de ces colonnes.
- Cancel Stripe : la route ne fait que passer en `cancelled_pending_refund` ; l'Edge Function `cancel-booking`
  rembourse. Elle n'est pas touchée.

### Established Patterns
- Aucune des routes concernées n'appelle de service externe : tout est RPC, aucune Edge Function nécessaire
  (contrairement à l'hypothèse « RPC ou Edge Function » du ROADMAP).
- Les routes vérifient le tenant à la main (`.eq("current_tenant_id", profile.tenant_id)`) : la RPC le fait via
  `current_tenant_id()`, plus par le corps de la requête.

### Integration Points
- `locals.supabase` (client serveur à cookies, posé par `middleware.ts`) devient le seul client des routes.
- Types : régénérer `packages/database/src/database.types.ts` après chaque migration de RPC.

</code_context>

<specifics>
## Specific Ideas

- Constats de sécurité confirmés dans le code, à refermer : `update-booking-status` (statut libre, `service_role`),
  `terrain-transition` (pas de contrôle `driver_id`), `update-settings` (route non restreinte à `owner`),
  `setup.astro` (mass assignment sur `tenants`), `rate/[id]` (`select('*')` complet en `service_role`).
- Contrainte forte : pas de refonte des routes/pages Astro, elles sont jetables (Phase 17).

</specifics>

<deferred>
## Deferred Ideas

- `api/auth/login` : n'utilise pas le client admin ; remplacée par `signInWithPassword` côté client en Phase 17.
- Realtime, Web Push, hors ligne : phases suivantes (ADR-011).
- Droits fins du rôle `manager` au-delà de la parité avec `owner` : suivi dans `.planning/BACKLOG.md`.
- Rate-limit / captcha sur la notation publique : non demandé ; l'UUID sert de jeton et la note est à usage unique.

</deferred>

---

*Phase: 14-routes-serveur-rpc-edge-functions*
*Context gathered: 2026-09-29*
