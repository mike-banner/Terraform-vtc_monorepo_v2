# Phase 14: Routes serveur vers RPC - Research

**Researched:** 2026-09-29
**Domain:** Postgres RPC `SECURITY DEFINER` (Supabase), proxys Astro minces, migration de garde-fous SQL
**Confidence:** HIGH sur l'inventaire et les contraintes DB (lus dans le code et sur la base locale) ; MEDIUM sur l'etat de la production (non interrogeable depuis cette session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Les routes et pages Astro concernees gardent leur **URL et leur contrat JSON**. Seul l'interieur change : `locals.supabase` (session utilisateur) + `.rpc(...)`, plus aucun `createAdminClient`. Les scripts front (`scripts/bookings.ts`, `scripts/app-layout.ts`, `dashboard.astro`) ne sont **pas** modifies. Ces routes disparaissent avec la SPA en Phase 17 : aucune refonte.
- **D-02:** Inventaire reel (les 10 fichiers du ROADMAP) : `api/tenant/{booking-actions, create-booking, update-booking-status, update-logo, update-settings}`, `api/missions/terrain-transition`, `api/submit-rating`, `pages/rate/[id].astro`, `pages/app/setup.astro`, `lib/supabase/server.ts`. Les autres routes `api/tenant/*` (`bookings`, `export-csv`, `export-fec`, `search-bookings`) utilisent deja la session utilisateur : inchangees. Il y en a 9 au total, pas 8 comme ecrit dans le ROADMAP.
- **D-03:** La formule (distance/heure, regle tarifaire, TVA TTC->HT) vit dans une **fonction SQL unique** (`calculate_booking_price` ou equivalent), appelee en interne par les RPC de creation et de modification. Elle remplace `calculatePrice` / `computeVat` / `findPricingRule` de `lib/pricing.ts` pour les ecritures. Testee dans la suite SQL de la CI. Le planner verifie si `vtc-websites` / `stripe_webhook` ont leur propre copie de la formule et evite la divergence.
- **D-04:** `create-booking` : le montant manuel (`manual_total`) est **conserve** tel quel. Plafond 9999 EUR et TVA recalcules cote serveur dans la RPC, `pricing_mode = 'manual'` trace. Le chauffeur connecte doit avoir une fiche `drivers` (comportement actuel). La creation (client, TVA tenant, prix, insertion) est **une seule RPC transactionnelle**.
- **D-05:** `api/tenant/update-booking-status` est **supprimee** (aucun appelant dans le front ; acceptait un statut libre en `service_role`), ainsi que sa ligne dans `ROUTE_POLICY`. Pas de RPC de remplacement.
- **D-06:** **Une RPC par intention**, pas de RPC fourre-tout : `terrain_transition(booking_id, action, corrected_at)` (en_route / on_board / completed), `driver_cancel_booking(booking_id, reason)`, `update_booking_details(booking_id, ...)` (modification pre-mission avec recalcul de prix, D-03). Les signatures exactes sont au planner.
- **D-07:** Garde de role : `driver` n'agit que sur **ses** courses (`driver_id`), `owner`/`manager` sur toutes celles du tenant (reprend D-05/D-06 de la Phase 13). Sinon erreur `42501`. Les transitions rejouees (marqueur `[terrain]` deja pose) restent **idempotentes** et renvoient succes. La regle H-15 (ADR-002) est conservee dans la RPC ; elle s'appuie sur `trg_validate_booking_status_transition`.
- **D-08:** `mission_status` ne change plus que via ces RPC. La regle « Interdits » de `apps/vtc-backoffice/CLAUDE.md` est mise a jour en consequence, ainsi que la ligne de la table « Fichiers coeur ».
- **D-09:** Deux **RPC appelables par `anon`** : `get_rating_context(booking_id)` (renvoie seulement nom, logo, URL avis Google du tenant + deja-note ; plus de `select('*')`) et `submit_rating(booking_id, rating, comment)` (course terminee, non encore notee, note 1-5, commentaire tronque a 500). L'UUID de course reste le jeton d'acces. `REVOKE EXECUTE ... FROM PUBLIC` puis `GRANT EXECUTE ... TO anon` explicite.
- **D-10:** `rate/[id]` et `submit-rating` sont **deplaces vers `vtc-websites`** (cle anon seulement). Le QR de `RatingQRModal` et `bookings.ts` pointent vers la nouvelle URL. Le backoffice n'a plus aucune page publique. Les liens existants sont ephemeres. La resolution de l'URL/domaine cote websites est a etablir par la recherche.
- **D-11:** `update-logo` et `update-settings` passent par **deux RPC reservees a `owner`** : `update_tenant_logo(url)` conserve la validation du prefixe du bucket public `assets` ; `update_tenant_settings(legal_form, vat_number)` laisse `trg_sync_tenant_vat` deriver `is_vat_exempt` et `vat_rate`.
- **D-12:** `setup.astro` : le POST devient **une RPC transactionnelle** `complete_tenant_setup(legal, vehicle, pricing)` : `owner` seul, `setup_completed = false` requis, colonnes ecrites listees explicitement, tout ou rien. La page ne change que son POST.
- **D-13:** `SUPABASE_SERVICE_ROLE_KEY` retire de `backoffice_env_vars` (Terraform), `lib/supabase/server.ts` supprime, et un **step CI** (grep) echoue si `createAdminClient` ou `SUPABASE_SERVICE_ROLE_KEY` reapparait dans `apps/vtc-backoffice`. Le retrait en production exige un GO explicite (Terraform, hors merge).

### Claude's Discretion
- Signatures, nommage et format des erreurs des RPC (au planner), du moment que `42501` signale un refus de role.
- Ordre de deploiement : migrations (RPC) avant le code des routes, retrait de la cle en dernier. Le planner decoupe en plans livrables separement ; la mise en production suit le schema de la Phase 13 (plan dedie + GO).
- Tests : une suite SQL par role pour chaque RPC (owner / manager / driver propre course / driver autre course / autre tenant / anon), integree a `db-lint.yml`, sur le modele de `rls_role_checks.sql`.

### Deferred Ideas (OUT OF SCOPE)
- `api/auth/login` : remplacee par `signInWithPassword` cote client en Phase 17.
- Realtime, Web Push, hors ligne : phases suivantes (ADR-011).
- Droits fins du role `manager` au-dela de la parite avec `owner` : suivi dans `.planning/BACKLOG.md`.
- Rate-limit / captcha sur la notation publique : non demande.
</user_constraints>

## Project Constraints (from CLAUDE.md)

- RLS jamais desactivee. Aucun calcul financier cote client (montants, TVA). `financial_movements` immuable, INSERT `service_role` uniquement.
- Couleurs : tokens semantiques uniquement (jamais de couleur Tailwind en dur).
- Migrations : un fichier horodate par changement, jamais d'edition d'une migration appliquee ; regenerer `packages/database/src/database.types.ts` (`pnpm --filter @vtc/vtc-backoffice gen:types`) avant de coder dessus.
- Pas de branche directe sur `main`/`dev`, pas de merge sans validation explicite. Aucun secret dans le repo.
- Avant `git push` : rejouer `tsc --noEmit` (`astro build` ne typecheck pas) [memoire projet].
- `apps/vtc-backoffice/CLAUDE.md` : « Interdits » et « Fichiers coeur » a mettre a jour (D-08). `apps/vtc-websites/CLAUDE.md` : « vitrine passive, aucune ecriture », a amender pour les 2 RPC de notation.
- Commits : aucune mention IA.
- Planning : `.planning` est un symlink vers le Vault, hors git ; la copie versionnee est `docs/planning/` (a dupliquer).

<phase_requirements>
## Phase Requirements

Aucun ID mappe (phase_req_ids null). Les puces du ROADMAP servent de referentiel.

| Puce ROADMAP | Support de recherche |
|---|---|
| Inventaire routes / `createAdminClient` | Section Inventaire ci-dessous (verifie par grep) |
| Transitions en RPC uniques, idempotentes, gardees | Patterns 1-2, pieges 1-4 (triggers, table de transitions vide, ledger) |
| create-booking prix serveur | Pattern 3, section Formule de prix |
| rating vers vtc-websites | Pattern 5 |
| `auth/login` | Hors phase (deferred) |
| Retrait `SUPABASE_SERVICE_ROLE_KEY` Terraform | Section Fin de phase |
</phase_requirements>

## Summary

Les 10 fichiers `createAdminClient` du CONTEXT sont confirmes par grep (`server.ts` + 9 appelants ; `update-booking-status` supprime). Toutes les ecritures sont de la logique Postgres pure : aucune Edge Function necessaire. Le vrai travail est de faire tenir les RPC `SECURITY DEFINER` face aux triggers existants de `bookings`, et trois faits decouverts dans le code changent le plan par rapport au CONTEXT :

1. **`booking_status_transitions` est vide sur la base locale** (0 ligne, aucun `INSERT` dans les migrations ni de seed). `trg_validate_booking_status_transition` rejette donc tout changement de `status` en local/CI. En production la table a peut-etre ete remplie a la main : **non verifiable d'ici**. Tant que le trigger etait desactive en prod (jusqu'a la migration `20260929100300`), personne ne le voyait. Depuis sa reactivation, `terrain-transition` (`completed`) et le flux `cancelled_*` peuvent deja echouer en prod si la table est vide. D-07 (« s'appuie sur ce trigger ») exige une migration de seed de cette table, et une verification prod immediate.
2. **`auto_create_financial_movement` (SECURITY DEFINER) leve `42501` si `auth.jwt()->>'role'` n'est pas `service_role`** lors d'un encaissement cash (`mission_status -> completed`, `payment_mode = 'cash'`) ou carte. Une RPC appelee avec la session chauffeur garde le JWT `authenticated` meme en `SECURITY DEFINER` : `terrain_transition('completed')` sur une course cash echouera. C'est la tension « ledger INSERT service_role » vs « plus de service_role dans Astro » ; elle se resout dans la migration (voir Pattern 2), pas par une Edge Function.
3. **`trg_protect_booking_fields` (reactive le 2026-09-29) interdit de changer `total_amount`, adresses, `pickup_time` des que `status <> 'pending'`.** `booking-actions` action `update` ecrit exactement ces colonnes sur des courses `accepted`/`paid`. Le comportement actuel en prod (trigger desactive) est donc deja casse depuis la reactivation. `update_booking_details` doit trancher : quels statuts autorises, et comment contourner le trigger de facon controlee.

**Primary recommendation:** ordonner les plans ainsi : (0) verifier la prod (transitions, 3 triggers) ; (1) migration socle : seed `booking_status_transitions`, marqueur de confiance de session pour le ledger et pour `protect_booking_immutable_fields`, `calculate_booking_price` ; (2) RPC bookings (terrain / cancel / update / create) + tests SQL par role, **avec triggers actifs ET desactives** ; (3) RPC tenant (logo, settings, setup) ; (4) RPC anon + pages vtc-websites ; (5) routes Astro reecrites en proxys, suppression, lint CI ; (6) plan de deploiement prod + retrait Terraform sur GO.

## Inventaire verifie

| Fichier | Ecritures service_role aujourd'hui | Cible |
|---|---|---|
| `api/tenant/booking-actions.ts` | `bookings` UPDATE (cancel, update+prix) | `driver_cancel_booking`, `update_booking_details` |
| `api/tenant/create-booking.ts` | `customers` SELECT/INSERT, `tenants`/`vehicles`/`pricing_rules` SELECT, `bookings` INSERT | `create_manual_booking` (nom au planner) |
| `api/missions/terrain-transition.ts` | `bookings` UPDATE (`mission_note`, `mission_status`, `status`) | `terrain_transition` |
| `api/tenant/update-booking-status.ts` | `bookings` UPDATE statut libre | supprime (D-05) + ligne `ROUTE_POLICY` l.50 de `lib/guards.ts` |
| `api/tenant/update-logo.ts` | `tenants` UPDATE `logo_url` | `update_tenant_logo` |
| `api/tenant/update-settings.ts` | `tenants` UPDATE 4 colonnes | `update_tenant_settings` |
| `api/submit-rating.ts`, `pages/rate/[id].astro` | `bookings` SELECT `*` + UPDATE rating | `get_rating_context` / `submit_rating` (anon), pages vers websites |
| `pages/app/setup.astro` (POST) | `drivers` upsert, `tenants` UPDATE `...body`, `vehicles`/`pricing_rules` INSERT | `complete_tenant_setup` |
| `lib/supabase/server.ts` | definit `createAdminClient` | supprime |

Appelants front a ne pas toucher (D-01) : `scripts/bookings.ts` (l.71, 857, 922, 1050, 175), `scripts/app-layout.ts` (l.29), `dashboard.astro` (l.538), `settings.astro` (l.273, 314). Le `update-booking-status` n'a aucun appelant (grep) [VERIFIED: grep].

Autres occurrences de `createAdminClient`/`SERVICE_ROLE` sous `apps/vtc-backoffice` hors `src/` : `.env`, `README.md`, `SECURITY_REVIEW.md`, `ANTIGRAVITY.md`, `CLAUDE.md` et **9 scripts `test/scripts/*.ts`** (debug, utilisent la cle). Le step CI de D-13 doit soit cibler `apps/vtc-backoffice/src` seulement, soit ces scripts doivent sortir du perimetre (les deplacer vers `scripts/` racine). A trancher par le planner ; recommandation : grep sur `src/` + `wrangler`/`astro.config` + Terraform, et deplacer `test/scripts/`.

## Standard Stack

Aucune nouvelle dependance. Tout est Postgres + outillage deja en place.

| Element | Version | Usage |
|---|---|---|
| Supabase CLI (`/usr/local/bin/supabase`), Postgres local 17.6 (conteneur `supabase_db_vtc_repo_v2` actif) | installe | `supabase db reset`, tests SQL locaux |
| `psql` (`/usr/bin/psql`) | installe | executer `supabase/lint/*.sql` |
| `@supabase/supabase-js` `.rpc()` via `locals.supabase` | ^2.99 (websites) / ^2.108 (racine) | appel des RPC avec la session |
| Tests SQL maison (`pg_temp.expect_*`, `SET LOCAL ROLE`, `request.jwt.claims`) | `supabase/lint/rls_role_checks.sql` | modele a reutiliser tel quel |

**Ne rien ajouter** : pas de Zod cote Astro pour les proxys (validation dans la RPC), pas d'ORM, pas de lib de prix.

## Architecture Patterns

### Structure
```
supabase/migrations/2026093010xxxx_*.sql   # une migration par changement (socle, bookings, tenant, rating)
supabase/lint/rpc_role_checks.sql          # nouveau, meme modele que rls_role_checks.sql
supabase/lint/pricing_checks.sql           # (ou section de rpc_role_checks) vecteurs de prix
apps/vtc-backoffice/src/pages/api/...      # proxys : auth locals, supabase.rpc, mapping d'erreur
apps/vtc-websites/src/pages/rate/[id].astro + pages/api/submit-rating.ts
```

### Pattern 1 : squelette de RPC gardee (toutes les RPC authentifiees)
**What:** `SECURITY DEFINER`, `SET search_path = ''` (ou `public` comme le reste du repo, le lint `security_checks.sql` exige un search_path fige), garde de role en premiere instruction, `REVOKE ... FROM PUBLIC` puis `GRANT ... TO authenticated`.
```sql
CREATE FUNCTION public.terrain_transition(p_booking_id uuid, p_action text, p_corrected_at timestamptz DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_role public.tenant_role := public.current_tenant_role();
        v_tenant uuid := public.current_tenant_id(); b public.bookings;
BEGIN
  IF v_role IS NULL OR v_tenant IS NULL THEN RAISE EXCEPTION 'non autorise' USING ERRCODE='42501'; END IF;
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id
     AND (original_tenant_id = v_tenant OR current_tenant_id = v_tenant) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'course introuvable' USING ERRCODE='P0002'; END IF;
  IF v_role = 'driver' AND b.driver_id IS DISTINCT FROM
     (SELECT id FROM public.drivers WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'course d''un autre chauffeur' USING ERRCODE='42501';
  END IF;
  ...
END $$;
REVOKE EXECUTE ON FUNCTION public.terrain_transition(uuid,text,timestamptz) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.terrain_transition(uuid,text,timestamptz) TO authenticated;
```
Points d'attention :
- `SELECT ... FOR UPDATE` : rend les rejeux concurrents sequentiels donc l'idempotence fiable.
- Le filtre tenant reprend exactement la clause de la policy `bookings_update` (`original_tenant_id` OU `current_tenant_id`) ; la route actuelle ne filtre que `current_tenant_id`. Garder `current_tenant_id` seul si on veut ne pas elargir : decision du planner, documenter.
- `current_tenant_role()`/`current_tenant_id()` sont `STABLE` invoker : appelees depuis une fonction DEFINER elles s'executent comme owner et lisent `auth.uid()` depuis le GUC : OK [VERIFIED: 20260929100000, lecture du code].
- Le lint `security_checks.sql` (section 3) rejette une DEFINER sans `search_path` fige ; les policies `role_tables` interdisent `FOR ALL` : les RPC ne sont pas concernees mais respecter le style.
- `REVOKE ... FROM PUBLIC` obligatoire puis GRANT explicite (piege `20260925090000`, memoire projet). Pour les 2 RPC anon : `GRANT ... TO anon, authenticated` (une page de notation ouverte depuis un navigateur deja connecte envoie le JWT authenticated ; ne pas oublier `authenticated`, sinon 403 pour un chauffeur qui teste son propre lien).
- Codes d'erreur : `42501` refus de role (imposé), `P0002` introuvable, `22023`/`P0001` validation. PostgREST : `42501` -> HTTP 403, `P0002` -> 404 [CITED: postgrest.org/en/stable/references/errors.html]. Cote proxy Astro, mapper `error.code` vers les statuts que le front attend deja (401/400/404/500) sans changer le JSON : `{ error: string }` ; conserver `{ error:'Too early', available_at }` pour H-15 (`terrain-transition` renvoie ce champ au front).

### Pattern 2 : socle de garde pour ledger et immuabilite (decision structurante)
Probleme (faits 2 et 3 du Summary). Options :
- **A (recommandee) :** un marqueur transactionnel pose par les RPC de confiance : `PERFORM set_config('vtc.trusted_rpc', 'on', true);` en debut de RPC ; `auto_create_financial_movement` accepte `coalesce(auth.jwt()->>'role','service_role') = 'service_role' OR current_setting('vtc.trusted_rpc', true) = 'on'`. Idem pour `protect_booking_immutable_fields` dans la seule RPC `update_booking_details`. Un client PostgREST ne peut pas poser un GUC arbitraire (pas de `set_config` expose ; `SET` n'est pas atteignable) donc le marqueur n'est pas forgeable depuis l'API [ASSUMED: comportement PostgREST sur `pg_catalog.set_config`, a verifier par un test negatif en CI : `authenticated` ne peut pas appeler `set_config` via `.rpc`].
- B : rester en `service_role` uniquement pour l'encaissement via une Edge Function : contredit D-13 et ajoute un appel reseau ; rejete.
- C : deplacer la creation du mouvement cash dans la RPC elle-meme : duplique la logique du trigger, deux chemins d'ecriture du ledger ; rejete.

Le ledger reste immuable (aucun UPDATE/DELETE) ; seul le critere d'autorisation d'INSERT dans le trigger DEFINER s'elargit a « appelant = RPC de confiance ». **Ce changement touche la regle « INSERT reserve au service_role » du CLAUDE.md racine : a faire valider explicitement par l'utilisateur (voir Open Questions Q2) avant ecriture.**

### Pattern 3 : formule de prix unique
`calculate_booking_price(p_tenant uuid, p_vehicle uuid, p_type booking_type_enum, p_km numeric, p_hours numeric)` retourne `numeric` TTC ; `booking_vat_split(gross, vat_rate, is_exempt)` retourne `(net, vat, gross)`. Regles a reproduire a l'identique de `lib/pricing.ts` :
- Regle : `active`, categorie vehicule en `lower(trim())`, sinon **premiere regle**. L'ordre n'est pas defini dans `booking-actions` (pas d'ORDER BY) mais `create-booking` trie `created_at DESC` : figer `ORDER BY created_at DESC` (deterministe) et le noter comme changement mineur.
- `hourly` : `base + price_per_hour * hours` ; sinon `base + price_per_km * km` ; puis `GREATEST(total, minimum_fare)`. Defauts : km 0, heures 1.
- TVA : `is_vat_exempt IS DISTINCT FROM false` => exonere (NULL = exonere) ; sinon `net = round(gross/(1+rate/100), 2)`, `vat = round(gross - net, 2)`, `gross` non arrondi. Utiliser `numeric` (pas `float`) ; `round(numeric,2)` arrondit half away from zero comme `Math.round` sur positifs ; vecteurs de test aux bornes `.005` pour confirmer la parite.
- Plafond manuel : `total <= 0 OR total > 9999` => erreur (`22023`), `pricing_mode='manual'` si `manual_total > 0` sinon `'direct'` ; aucune regle ET pas de montant manuel => erreur.

**Copies de la formule (D-03, a ne pas laisser diverger) :**
| Emplacement | Contenu | Action |
|---|---|---|
| `apps/vtc-backoffice/src/lib/pricing.ts` | source actuelle ; **aussi importee cote client** par `scripts/bookings.ts` l.635-660 et l.999-1015 pour previsualiser le prix | garder pour l'apercu (D-01 interdit de toucher les scripts) ; le supprimer des routes. Signaler dans CLAUDE.md que l'apercu client n'est pas contractuel |
| `supabase/functions/create_checkout_session/index.ts` l.150-200 | copie TS + prix `fixed_routes` ; pas de TVA ; `safeTotal` mini 1 | hors perimetre ; documenter comme dette (deuxieme copie) |
| `supabase/functions/stripe_webhook/index.ts` l.190-225 | recalcul + TVA (meme arrondi) | hors perimetre ; idem |
| `apps/vtc-websites/src/lib/pricing-engine.ts` | `fixed_routes`/zones uniquement, pas la formule km/h | rien |
Recommandation : ne pas migrer les Edge Functions dans cette phase (elles sont en `service_role` legitimement, paiement) ; ajouter dans le plan un vecteur de test commun (mêmes entrees/sorties) documente pour les trois implementations, et une entree `BACKLOG.md`.

### Pattern 4 : RPC de transition
- `terrain_transition` : reprendre exactement la logique actuelle : tags `en_route_at`/`on_board_at`/`completed_at`, marqueur `[terrain] tag=iso` ajoute une seule fois, `completed_at_was_corrected=true` si `corrected_at` valide (date invalide ignoree), H-15 seulement pour `en_route` (`now() < pickup_time - 15 min` => erreur avec `available_at`). Effets : `en_route` -> `mission_status='in_progress'` ; `on_board` -> note seule ; `completed` -> `status='completed'` ET `mission_status='completed'`. **Idempotence :** si le marqueur existe deja, ne rien ecrire et renvoyer succes avec la note courante (comportement actuel : il reecrit `mission_status`/`status` meme si deja pose ; verifier qu'un rejeu de `completed` sur une course deja `completed` ne redeclenche pas `trg_validate_booking_status_transition`, deja court-circuite car `WHEN old.status IS DISTINCT FROM new.status`).
- Contrat de retour : `{ success:true, mission_note }` -> la RPC retourne `mission_note` (text) ; le proxy fabrique le JSON.
- `driver_cancel_booking(booking_id, reason)` : reproduire `PRE_MISSION_STATES = ('to_validate','not_started')`, motif obligatoire (trim), `status = 'paid' -> cancelled_pending_refund` sinon `cancelled_no_refund`, `cancellation_initiator='driver'`, `cancelled_at=now()`, marqueur `[annulation] initiateur=chauffeur | motif=...` ajoute a `mission_note`. **Idempotence :** si deja `cancelled_*` avec initiateur driver, succes sans rien ecrire. **Regle « pas d'annulation apres l'heure de prise en charge » a coder explicitement dans la RPC** (ne pas laisser `trg_prevent_late_cancellation` la porter : desactive en prod, voir pieges). Le remboursement Stripe reste hors RPC (Edge Function `cancel-booking`, intacte).
- `update_booking_details` : garde statut pre-mission (memes `PRE_MISSION_STATES`), `pickup_time` + `pickup_address` requis, `dropoff_address`/`distance_km`/`duration_hours` optionnels, recalcul via `calculate_booking_price` (si `> 0` remplace `total_amount`/`subtotal_amount`). **Attention :** l'ancien code met `subtotal_amount = total` et **ne recalcule pas `vat_amount`** ; recalculer la TVA correctement (net/vat) est la correction attendue, mais c'est un changement de comportement financier : le signaler au planner/utilisateur. Refuser `status='paid'` (client a deja paye le montant ; aligne sur `prevent_pickup_time_change_after_paid`).

### Pattern 5 : notation publique vers vtc-websites
- `get_rating_context(p_booking_id)` : `SECURITY DEFINER`, `STABLE`, retourne `table(tenant_name, logo_url, google_reviews_url, already_rated boolean)` ; 0 ligne si la course n'existe pas (le front redirige vers 404). Ne renvoyer ni `mission_status` ni rien d'autre de la course. Peut-on noter ? La page actuelle n'affiche pas l'erreur « course non terminee » tant qu'on ne soumet pas ; garder ce comportement (l'erreur vient de `submit_rating`).
- `submit_rating(p_booking_id, p_rating int, p_comment text)` : `UPDATE ... WHERE id = p AND mission_status='completed' AND rating IS NULL` en une instruction (atomique, pas de course TOCTOU) puis distinguer les cas (introuvable / non terminee / deja note) pour les messages existants (« Reservation non trouvee », « Course non terminee », « Deja note », « Note invalide (1-5) »). Colonnes ecrites : `rating`, `rating_comment`, `rating_created_at = now()` (l'horloge devient celle du serveur DB). **Le `UPDATE` declenche les triggers de `bookings`** : `trg_protect_booking_fields` (`status <> 'pending'` : compare `total_amount`, adresses, `pickup_time`, `payment_mode`, ne touche pas `rating` : OK), `trg_prevent_*` idem OK. A couvrir par un test anon sur une course `completed`.
- Cote websites : ajouter `src/pages/rate/[id].astro` (route statique, prioritaire sur `[...path].astro` en Astro) et `src/pages/api/submit-rating.ts` (proxy anon, meme contrat JSON `{bookingId, rating, comment}` pour reprendre le script de page tel quel). Client : `import { supabase } from "../../core/supabase"` (cle anon, deja en place).
- **Domaine / URL (D-10, question ouverte du CONTEXT) :** `vtc-websites` resout le tenant par `Host` (ADR 0002, RPC `get_public_tenant`) mais la page de notation n'en a pas besoin : `get_rating_context` renvoie le tenant depuis la course. Donc n'importe quel host des websites sert la page. Recommandation : le lien = `https://{tenant.primary_domain}/rate/{id}` si `primary_domain` est renseigne, sinon repli sur une variable `PUBLIC_WEBSITES_URL` (nouvelle) du backoffice pointant vers le projet Pages des websites. `PUBLIC_SITE_URL` existe deja dans `RatingQRModal.tsx` l.24 et `bookings.ts` l.174 avec repli `window.location.origin` (= le backoffice, donc casse apres deplacement) ; **elle n'est definie ni dans Terraform ni dans `.env`** [VERIFIED: grep terraform/.github]. Il faut donc l'ajouter (variable de build : `PUBLIC_*` vient des secrets GitHub selon `main.tf`) ou passer `primary_domain` en prop. Le middleware websites tombe sur un tenant « Elite Lyon » par defaut si le host est inconnu : sans impact ici car la page n'utilise pas `locals.tenant`.
- Le gabarit `rate/[id].astro` utilise `MainLayout` du backoffice, des couleurs Tailwind en dur (`bg-[#050505]`, `rose-500`, `emerald`, `indigo`) et des classes `glass`. Le deplacer tel quel viole la regle « tokens semantiques » et `MainLayout` n'existe pas cote websites (daisyUI). Prevoir la reecriture du gabarit avec le layout/tokens websites ; c'est la seule vraie tache UI de la phase. Le `Astro.redirect('/404')` suppose une page 404 : verifier qu'elle existe cote websites.
- Amender `apps/vtc-websites/CLAUDE.md` (tableau « Acces Supabase » et « Interdits »).

### Pattern 6 : parametres tenant et onboarding
- Aucune policy UPDATE tenant sur `tenants` pour `authenticated` (policies : `tenants_select_own`, `tenants_platform_admin_read/write`, `service_role_full_access_tenants`) [VERIFIED: base locale] ; les GRANT de table existent mais sans policy, un UPDATE direct est filtre a 0 ligne. D'ou les RPC DEFINER.
- `update_tenant_logo(p_url)` : owner seul (D-11 ; manager exclu comme `ROUTE_POLICY`). Prefixe : la route utilise `import.meta.env.PUBLIC_SUPABASE_URL` ; en SQL, pas d'acces a l'env. Options : passer le prefixe attendu depuis le proxy est **inutile** (le client controle le corps) ; le calculer en SQL n'est pas possible sans la config. Recommandation : valider le motif `'^https://[a-z0-9]{20}\.supabase\.co/storage/v1/object/public/assets/'` + comparer a `current_setting('app.settings.supabase_url')` non disponible par defaut : **le plus simple et sur est un `CHECK`-like regex sur le sous-chemin `/storage/v1/object/public/assets/` sans figer le host**, et scoper le chemin au tenant (`assets/<tenant_id>/...`) si l'upload le respecte (a verifier dans `settings.astro` l.273 et la policy de stockage). Voir Open Question Q4.
- `update_tenant_settings(p_legal_form, p_vat_number)` : owner seul ; ne plus ecrire `is_vat_exempt`/`vat_rate` : `trg_sync_tenant_vat` (`BEFORE INSERT OR UPDATE OF legal_form`) les derive. **Piege :** le trigger ne se declenche que si la colonne `legal_form` figure dans le `SET` (meme valeur suffit : `UPDATE OF` s'active sur la liste de colonnes du SET, pas sur un changement de valeur). Et pour une forme assujettie, `is_vat_exempt`/`vat_rate` ne sont modifies que si le tenant etait deja exonere (`OLD.is_vat_exempt = true AND NEW.is_vat_exempt = true`) : un tenant `is_vat_exempt=false` qui passe de `ei` a `sasu` : le trigger `ei` a mis `exempt=true`, donc OK ; mais un `sasu` deja assujetti a taux 20 qui repasse `sasu` garde 20 (comportement voulu, « reglage UI »). L'ancienne route forcait `vat_rate = 10` : la RPC ne le fait plus (D-11 l'assume). Valider `legal_form` contre la liste `('auto_entrepreneur','ei','sasu','sas','eurl','sarl','other')`, sinon le trigger ne fait rien et une valeur libre est stockee.
- `complete_tenant_setup(p_legal jsonb, p_vehicle jsonb, p_pricing jsonb)` : modele `approve_onboarding_tx`. Ecrire colonnes explicites de `tenants` : recenser dans `setup.astro` (l.24-97 et le formulaire) quelles cles composent `legal` (forme juridique, siret, siren, rcs, capital, TVA, etc.) et ne lister que celles-la ; retirer `vtc_license_number` (va dans `drivers.license_number`). `setup_completed = false` requis sinon `42501`/erreur. `drivers` upsert sur `user_id` (contrainte `drivers_user_id_key` existante [VERIFIED]) : la RPC etant DEFINER, la policy `drivers_insert` (owner/manager) n'est pas un obstacle. **Bug existant :** `pricing_rules` n'a pas de colonne `price_per_minute` (colonnes locales : `price_per_hour` seulement ; l'INSERT actuel de `setup.astro` l'ecrit) : l'INSERT echoue localement. Verifier la base prod ; ne pas reproduire `price_per_minute` dans la RPC, et decider si `price_per_hour` recoit une valeur par defaut. `vehicles` a `luggage_capacity` et `brand/model/plate_number/status` NOT NULL.

## Don't Hand-Roll

| Probleme | Ne pas construire | Utiliser | Pourquoi |
|---|---|---|---|
| Autorisation par role | Controle dans le proxy Astro | `current_tenant_role()` / `current_tenant_id()` dans la RPC | La RPC servira telle quelle a la SPA (ADR-011) ; le proxy est jetable |
| Validation des transitions de statut | Machine a etats dans la RPC | `trg_validate_booking_status_transition` + table `booking_status_transitions` | Garde unique aussi pour les Edge Functions |
| TVA d'un tenant | Calcul en dur (`vat_rate = 10`) | `trg_sync_tenant_vat` | Deja la source de verite (ADR-007) |
| Numero de facture | Compteur | `next_invoice_number` | Hors phase mais interdit de le toucher |
| Tests de role | Framework de test | `pg_temp.expect_*` de `rls_role_checks.sql` | Modele en place, tourne en CI sans secret |
| Onboarding transactionnel | Sequence d'appels REST | Une fonction plpgsql (une transaction) | Tout ou rien, ferme le mass assignment |

## Runtime State Inventory

Phase de refactor de chemin d'ecriture (pas un rename), mais le retrait de cle est de l'etat runtime.

| Categorie | Elements trouves | Action |
|---|---|---|
| Donnees stockees | `bookings`, `tenants`, `customers` : aucun renommage ; **`booking_status_transitions` : 0 ligne en local, contenu prod inconnu** | migration de seed (idempotente `ON CONFLICT DO NOTHING`) apres verification prod |
| Config de service live | Terraform Cloud workspace `vtc_prod` definit `supabase_service_role_key` (variable declaree `sensitive`, sans defaut, dans `variables.tf`) ; `.github/workflows/terraform.yml` l.27 injecte `TF_VAR_supabase_service_role_key` | apres retrait de `backoffice_env_vars`, la variable devient inutilisee : suivre le commentaire de `variables.tf` (supprimer cote repo ET workspace ensemble) ; **GO explicite** |
| Etat OS | Aucun | none, verifie par grep |
| Secrets / env vars | `SUPABASE_SERVICE_ROLE_KEY` dans `apps/vtc-backoffice/.env` (local), `terraform/main.tf` l.49, secret GitHub ; les tests e2e racine (`tests/*.spec.ts`) et `scripts/seed-demo-account.ts` l'utilisent legitimement (hors `apps/vtc-backoffice`) | ne pas les supprimer ; retirer seulement de `backoffice_env_vars` et de `.env` du backoffice ; la cle **doit rester** dans les secrets Supabase (Edge Functions) |
| Artefacts de build | Deployment Cloudflare Pages courant embarque encore la variable d'env tant que Terraform n'est pas applique ; `dist/` ; types `database.types.ts` | regenerer les types apres chaque migration RPC ; redeploiement Pages apres apply |

## Common Pitfalls

### Pitfall 1 : table `booking_status_transitions` vide
**What goes wrong:** tout `UPDATE ... SET status` d'une course leve `Invalid booking status transition` (local/CI) ; en prod, tout depend d'un contenu non versionne.
**Why:** aucune migration/seed n'insere dans cette table ; le trigger etait desactive en prod jusqu'au 2026-09-29.
**How to avoid:** (a) avant toute chose, requete lecture seule en prod (fait par l'utilisateur ou avec son GO) : `select from_status,to_status from booking_status_transitions order by 1,2;` ; (b) migration de seed avec les transitions reellement utilisees par le code : `paid->completed`, `accepted->completed`, `paid->cancelled_pending_refund`, `accepted->cancelled_no_refund`, `pending->cancelled_no_refund`, `accepted_pending_payment->cancelled_no_refund`, plus celles des Edge Functions (`stripe_webhook`, `cancel-booking`, `create_refund`, `accept-booking`, `expire`...) a recenser par lecture ; ne pas inventer : la liste doit venir du prod si elle existe.
**Warning signs:** erreur `Invalid booking status transition from X to Y` en test CI ; regression prod sur `terrain-transition completed` juste apres la Phase 13.

### Pitfall 2 : trois triggers `bookings` desactives en prod (fait donne)
Concernes : `trg_prevent_late_cancellation` (annulation apres `pickup_time`), `trg_prevent_pickup_time_change_after_paid` (statuts paid/completed/no_show/cancelled_*), `trg_prevent_policy_update` (`cancellation_policy_id` immuable une fois pose). Cause inconnue, aucune migration du repo ne les desactive ; `.claude/CLAUDE.md` du backoffice signale « triggers parfois desactives en dev » (`ENABLE TRIGGER ALL` en remede), donc une manip hors repo (dump/restore avec `session_replication_role`, ou action manuelle) est plausible.
**Decision recommandee (risque a arbitrer, Q1) :** les RPC ne doivent pas deleguer ces regles aux triggers. Coder dans la RPC : refus d'annulation apres `pickup_time` (`driver_cancel_booking`) ; refus de modification de `pickup_time` si `status IN ('paid','completed','no_show','cancelled_pending_refund','cancelled_refunded')` ; ne jamais ecrire `cancellation_policy_id`. Puis, separement, une migration corrective `ENABLE TRIGGER` des trois (idempotente, meme forme que `20260929100300`) apres avoir verifie que les flux existants (Stripe webhook, `cancel-booking`, admin plateforme) ne sont pas bloques (notamment `prevent_late_cancellation` vs remboursement d'une course passee). Ajouter aux tests : chaque garde verifiee **triggers actifs et triggers desactives** (`ALTER TABLE ... DISABLE TRIGGER` dans la transaction de test, restauration par `ROLLBACK`). Ajouter aussi un controle `tgenabled = 'O'` sur les 6 triggers `bookings` dans `security_checks.sql` (local) et, pour la prod, une requete dans le plan de deploiement (le job `migration-drift` ne voit pas l'etat des triggers).

### Pitfall 3 : ledger cash bloque pour un JWT `authenticated`
Voir Summary point 2 et Pattern 2. Symptome : `terrain_transition(completed)` sur une course `payment_mode='cash'` echoue en `42501 Encaissement enregistrable uniquement par le serveur`. Test obligatoire : chauffeur, course cash, `completed` -> un mouvement `financial_movements` `cash_completion` cree ; chauffeur, course carte payee -> aucun nouveau mouvement, pas d'erreur (le `paid` est deja passe).

### Pitfall 4 : `trg_protect_booking_fields` sur `update_booking_details`
Voir Summary point 3. Pour une course `accepted` (creee manuellement en `accepted`, donc jamais `pending`), toute modification de prix/adresse/heure est refusee. Choisir explicitement : autoriser la modification pour `accepted` non payee via le marqueur de confiance (Pattern 2, option A) ; `paid` refuse. Test : owner modifie une course `accepted` cash -> OK ; meme sur `paid` -> erreur metier.

### Pitfall 5 : `REVOKE` insuffisant
Un `REVOKE ... FROM anon, authenticated` ne retire pas le droit herite de `PUBLIC` (migration `20260925090000`). Les RPC authentifiees : `REVOKE FROM PUBLIC` + `GRANT TO authenticated`. Ajouter au lint : aucune fonction `public` `SECURITY DEFINER` executable par `anon` hors allowlist (`get_public_tenant`, `get_available_vehicles`, `get_public_booking_result`, `get_rating_context`, `submit_rating`).

### Pitfall 6 : contrat JSON
Le front lit `success`, `mission_note`, `new_status`, `new_total`, `total_price`, `booking_id`, `error`, `available_at`. Le proxy doit produire les memes cles (le codage de retour de la RPC doit donc fournir `new_status`, `new_total`, `total_price`, `booking_id`).

### Pitfall 7 : types et typecheck
`.rpc('terrain_transition', ...)` est type par `database.types.ts` : regenerer apres chaque migration (`gen:types` cible le projet **distant** `kpnkhmtxzigxtfnkmzru`, donc les RPC doivent etre appliquees en prod pour etre generees ; en local utiliser `supabase gen types typescript --local`). Ne pas commiter des types generes depuis une base locale differente sans le dire. Rejouer `tsc --noEmit` avant push.

### Pitfall 8 : `setup.astro` ecrit sur `profile.id`
`user_id: profile.id` (le `locals.profile` de la middleware) : dans la RPC utiliser `auth.uid()`, jamais un parametre.

## Code Examples

### Proxy Astro mince (modele)
```ts
// src/pages/api/missions/terrain-transition.ts
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.profile) return new Response("Unauthorized", { status: 401 });
  const { booking_id, action, corrected_at } = await request.json();
  const { data, error } = await locals.supabase.rpc("terrain_transition", {
    p_booking_id: booking_id, p_action: action, p_corrected_at: corrected_at ?? null,
  });
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 400;
    return new Response(JSON.stringify({ error: error.message }), { status });
  }
  return new Response(JSON.stringify({ success: true, mission_note: data }), { status: 200 });
};
```
Source : pattern `supabase.rpc` [CITED: supabase.com/docs/reference/javascript/rpc]. `locals.supabase` : middleware l.9 [VERIFIED: code].

### Test SQL par role (extrait, meme modele que `rls_role_checks.sql`)
```sql
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"<driver1>","role":"authenticated"}', true);
SELECT pg_temp.expect_denied('driver autre course', $q$select public.terrain_transition('<booking_driver2>','on_board')$q$);
SELECT public.terrain_transition('<booking_driver1>','on_board'); -- ok
SELECT public.terrain_transition('<booking_driver1>','on_board'); -- rejeu idempotent
```
Note : `expect_denied` du fichier existant capte `insufficient_privilege` (42501) ; c'est le bon code. Les fixtures (tenants A/B, owner, manager, 2 drivers, owner B) sont reutilisables : factoriser ou dupliquer dans un fichier `rpc_role_checks.sql` (ajouter le step dans `db-lint.yml` apres « RLS role checks »).

## Matrice de tests minimale (par RPC)
owner / manager / driver propre course / driver autre course / driver course non assignee / autre tenant / anon / `pending` (sans role) ; rejeu (idempotence) ; H-15 avant/apres l'heure ; course deja demarree (cancel/update) ; annulation apres `pickup_time` ; motif vide ; `paid` vs non paye ; cash completed -> ledger ; prix : vecteurs `transfer`/`hourly`, minimum_fare, exonere/assujetti, `.005`, manuel 0 / 9999 / 10000 ; notation : course non terminee, deja notee, note 0/6, commentaire 501 car., `get_rating_context` ne renvoie que 4 champs ; `complete_tenant_setup` : driver refuse, `setup_completed=true` refuse, cles inconnues ignorees (mass assignment) ; le tout **avec les triggers desactives** pour les gardes portees par la RPC.

## State of the Art

| Ancien | Actuel | Impact |
|---|---|---|
| Route Astro + `service_role` + controle a la main | RPC DEFINER gardee par role, appelee avec la session | logique reutilisable par la SPA (ADR-011) |
| `REVOKE FROM anon` | `REVOKE FROM PUBLIC` + GRANT explicite | evite le WARN linter « anon can execute SECURITY DEFINER » |
| `FOR ALL` policies | une policy par commande | contrainte deja verifiee par `security_checks.sql` |

## Environment Availability

| Dependance | Requis par | Disponible | Version | Repli |
|---|---|---|---|---|
| Docker + stack Supabase locale | tests SQL, `db reset` | oui (`supabase_db_vtc_repo_v2` up, port 54322) | Postgres 17.6 | - |
| `psql`, `supabase` CLI, `node` v20.20, `pnpm` | scripts et CI locale | oui | - | - |
| Acces prod (Supabase MCP / Management API) | verifier `booking_status_transitions`, `tgenabled`, colonnes `pricing_rules` | non depuis cette session | - | requete SQL lecture seule executee par l'utilisateur, ou `SUPABASE_ACCESS_TOKEN` (utilise par `scripts/check_migration_drift.py`) |
| Terraform Cloud `vtc_prod` | retrait de la cle | non teste | - | GO utilisateur, hors merge |

**Bloquant sans repli :** le contenu prod de `booking_status_transitions` et l'etat des 3 triggers (Q1) conditionnent la migration de seed et le plan de deploiement.

## Validation Architecture

### Test Framework
| Propriete | Valeur |
|---|---|
| Framework | SQL pur via `psql` (`\set ON_ERROR_STOP`, transaction annulee) + Playwright racine (`tests/*.spec.ts`, e2e, necessite des secrets) |
| Config | `.github/workflows/db-lint.yml`, `supabase/lint/*.sql` |
| Commande rapide | `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/lint/rpc_role_checks.sql` |
| Suite complete | `supabase db reset --no-seed` puis `security_checks.sql`, `rls_role_checks.sql`, `rpc_role_checks.sql` ; `pnpm --filter @vtc/vtc-backoffice typecheck` ; `pnpm --filter @vtc/vtc-websites build` |

### Phase (puces ROADMAP) -> Tests
| Comportement | Type | Commande | Existe ? |
|---|---|---|---|
| RPC gardees par role (matrice ci-dessus) | SQL | `psql -f supabase/lint/rpc_role_checks.sql` | non, Wave 0 |
| Formule de prix + TVA (parite JS) | SQL | `psql -f supabase/lint/rpc_role_checks.sql` (section prix) | non, Wave 0 |
| Triggers actifs (6 sur `bookings`) et table de transitions non vide | SQL lint | `security_checks.sql` (a etendre) | partiel |
| Aucune DEFINER anon hors allowlist | SQL lint | `security_checks.sql` (a etendre) | non |
| Plus de `createAdminClient`/`SERVICE_ROLE` dans `apps/vtc-backoffice/src` | grep CI | `! git grep -nE 'createAdminClient|SUPABASE_SERVICE_ROLE_KEY' -- apps/vtc-backoffice/src` | non, step a ajouter |
| Contrat JSON des proxys, typecheck | tsc | `pnpm --filter @vtc/vtc-backoffice typecheck` | oui |
| Notation depuis vtc-websites | build + manuel | `pnpm --filter @vtc/vtc-websites build` ; test manuel du lien | manuel (justif : navigateur) |
| Verification prod (triggers, transitions, RPC presentes) | manuel | requetes SQL du plan de deploiement | manuel (acces prod) |

### Echantillonnage
- Par commit de tache : `rpc_role_checks.sql` local (< 30 s).
- Par merge de lot : suite complete ci-dessus.
- Gate de phase : suite complete verte + verification prod rejouee avant `/gsd-verify-work`.

### Wave 0
- [ ] `supabase/lint/rpc_role_checks.sql` (fixtures + matrice) ; step dans `db-lint.yml`
- [ ] extension de `security_checks.sql` : triggers `bookings` actifs, allowlist DEFINER anon
- [ ] step grep D-13 (job dedie dans `db-lint.yml` ou nouveau workflow)
- [ ] test negatif : `authenticated` ne peut pas poser le marqueur de confiance depuis l'API (si option A)

## Security Domain

Applicable (`security_enforcement` non desactive dans `.planning/config.json`).

| Categorie ASVS | S'applique | Controle |
|---|---|---|
| V2 Authentification | non (Phase 17) | - |
| V3 Session | indirect | JWT de session pour les RPC ; middleware existant |
| V4 Controle d'acces | oui | garde de role dans chaque RPC (`42501`), FOR UPDATE, tenant via `current_tenant_id()` |
| V5 Validation d'entrees | oui | validation dans la RPC (bornes, enumerations, longueur commentaire, liste blanche de colonnes) |
| V6 Cryptographie | non | - |

| Menace | STRIDE | Mitigation |
|---|---|---|
| Mass assignment (`setup.astro` `...tenantData`) | Tampering | colonnes explicites dans `complete_tenant_setup` |
| Statut libre en service_role (`update-booking-status`) | Elevation | route supprimee (D-05) |
| IDOR entre chauffeurs (`terrain-transition`) | Elevation | verif `driver_id` = fiche de `auth.uid()` |
| Fuite `select('*')` sur `rate/[id]` | Info disclosure | `get_rating_context` limitee a 4 champs |
| Enumeration/spam de notes (UUID = jeton) | Tampering | note a usage unique (`rating IS NULL`), UUID non devinable ; rate-limit differe (deferred) |
| Forge du marqueur de confiance ledger | Tampering / Elevation | GUC transactionnel, non atteignable depuis PostgREST (a prouver par test) ; EXECUTE des RPC verrouille |
| Fonction DEFINER ouverte a PUBLIC | Elevation | `REVOKE ... FROM PUBLIC` + allowlist lint |
| URL de logo arbitraire (phishing) | Spoofing | validation du prefixe/chemin en SQL |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | PostgREST n'expose pas `set_config` a `authenticated`, donc un GUC `vtc.trusted_rpc` n'est pas forgeable | Pattern 2 | Un utilisateur pourrait contourner la garde ledger/immuabilite ; a couvrir par un test negatif |
| A2 | PostgREST mappe `42501` -> 403, `P0002` -> 404 | Pattern 1 | Mapping d'erreurs cote proxy a corriger (mineur) |
| A3 | La table `booking_status_transitions` est peut-etre peuplee en prod | Pitfall 1 | Si vide, `completed`/`cancelled_*` cassent deja en prod |
| A4 | Le prefixe de logo peut etre valide par motif de chemin sans connaitre le host | Pattern 6 | Un logo hors bucket `assets` du projet serait accepte |
| A5 | `price_per_minute` n'existe pas non plus en prod | Pattern 6 | Si elle existe, la RPC de setup devrait l'ecrire |
| A6 | Les Edge Functions (`stripe_webhook`, `cancel-booking`, ...) ne sont pas impactees par la reactivation des 3 triggers | Pitfall 2 | Un remboursement apres `pickup_time` pourrait etre bloque |

## Open Questions

1. **Que contiennent en prod `booking_status_transitions` et l'etat des 3 triggers ?** (RISQUE CRITIQUE)
   - Connu : locale vide ; prod inconnue ; 3 triggers `tgenabled='D'`, cause inconnue.
   - Flou : la liste des transitions legitimes ; pourquoi les triggers etaient coupes.
   - Recommandation : requete lecture seule en prod avant de planifier le seed ; RPC autonomes pour les 3 gardes ; migration corrective d'activation dans un plan distinct, apres verification des flux Stripe.
2. **Valider l'ouverture du ledger aux RPC de confiance** (Pattern 2, option A) : modifie la regle « INSERT financial_movements reserve au service_role ». GO utilisateur requis avant migration.
3. **`update_booking_details` sur course `accepted` deja creee** : autoriser (via marqueur) ou limiter aux `pending` ? Quel statut est reellement « modifiable » cote metier ; recalcul de `vat_amount` (l'ancienne route ne le faisait pas).
4. **Logo** : les uploads sont-ils chemins `assets/<tenant_id>/...` (policy de stockage) ? Sinon la validation ne peut etre qu'un prefixe de bucket.
5. **Lien de notation** : `primary_domain` du tenant ou une variable `PUBLIC_WEBSITES_URL` ? Doit-on definir `PUBLIC_SITE_URL` dans `deploy.yml` (secrets de build) ?
6. **Perimetre du lint D-13** : `test/scripts/*.ts` du backoffice utilisent la cle ; les deplacer ou restreindre le grep a `src/`.
7. **Perimetre `original_tenant_id`** : les RPC filtrent-elles sur `current_tenant_id` seul (comportement actuel) ou sur les deux (policy Phase 13) ?

## Ordre de deploiement suggere (plans livrables)
1. Verification prod + migration socle (seed transitions, marqueur, `calculate_booking_price`, allowlist lint) ; tests.
2. RPC bookings (terrain, cancel, update, create) + `rpc_role_checks.sql` ; types.
3. RPC tenant (logo, settings, setup).
4. RPC anon + pages websites + lien QR ; amendement des deux `CLAUDE.md`.
5. Reecriture des proxys, suppression de `update-booking-status`/`ROUTE_POLICY`/`server.ts`, step CI grep.
6. Mise en production (schema Phase 13 : plan dedie + GO) : migrations d'abord, puis code, verification, puis retrait de la cle Terraform sur GO separe.
Chaque lot : branche dediee, commit par lot, aucun merge sans feu vert ; ecrire l'avancement dans `ROADMAP` et dupliquer `.planning/` vers `docs/planning/`.

## Sources

### Primary (HIGH)
- Code du depot lu : les 9 fichiers listes + `lib/pricing.ts`, `guards.ts`, `middleware.ts`, `terraform/main.tf`/`variables.tf`, `.github/workflows/db-lint.yml`, `supabase/lint/*.sql`, migrations `20260310000000` (baseline), `20260917`-`20260929100300`, Edge Functions `create_checkout_session`/`stripe_webhook` (formule).
- Base Postgres locale (psql) : triggers `bookings` tous `O`, `booking_status_transitions` = 0 ligne, colonnes `pricing_rules`/`tenants`/`bookings`, enums, policies `tenants`, contrainte `drivers_user_id_key`.
- ADR-002, ADR 0002 (websites), CONTEXT Phase 14.

### Secondary (MEDIUM)
- Documentation PostgREST/Supabase (erreurs, `.rpc`) citee de memoire : a reverifier au moment de l'implementation.

### Tertiary (LOW)
- Aucun.

## Metadata
- Standard stack : HIGH (aucune dependance nouvelle).
- Architecture : HIGH pour l'inventaire et les patterns ; MEDIUM pour le marqueur de confiance (A1).
- Pitfalls : HIGH (verifies sur la base locale) ; l'etat prod reste MEDIUM.

**Research date:** 2026-09-29
**Valid until:** 2026-10-29 (stack stable ; invalide si la prod revele une table de transitions differente)
