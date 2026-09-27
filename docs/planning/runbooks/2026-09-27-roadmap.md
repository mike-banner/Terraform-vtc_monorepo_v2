# Roadmap

## Phase 1: Migration Supabase & Stabilité Monorepo
**Status:** Complete
**Mode:** mvp

Extraction de la logique base de données et réparation du crash middleware.

### Phase 2: Refonte UX et UI du Backoffice (Dashboard, Alertes, Contraste)
**Status:** Complete

### Phase 3: Nettoyage et Finalisation Drivers Front (Sites, Assets, UX)
**Status:** Complete

### Phase 4: Full E2E & Hardening Backoffice
**Status:** Complete
**Goal:** Sécuriser le parcours complet et finaliser la logique métier
**Requirements**: 
- Mise en place d'un framework E2E Playwright global pour tester les failles.
- Test complet du parcours : Inscription -> Booking -> Déroulement Course -> QR Rating.
- Vérification des paramètres (Logo, Tarifs) et calculs des prix.

### Phase 4.5: Création de l'Application Master Admin Séparée
**Status:** Clos le 2026-09-27 avec reports (voir « Clôture du milestone V1 ») — était Mostly Complete (corrigé le 2026-09-25 — était marquée Complete à tort)
**Goal:** Contrôler efficacement les entreprises (Tenants) via une interface isolée
**Requirements**:
- [x] Création d'une application isolée `apps/superadmin` (Port 4323) sur le modèle SaaS standard — React/Vite, `vite.config.ts:9`.
- [x] Isolation physique "Air-Gap" pour garantir la sécurité des données Master.
- [x] Validation de conformité (Kbis/VTC) et "Kill Switch" par tenant — `src/pages/TenantsList.tsx`,
  migration `20260922000000_tenant_status_kill_switch.sql`.
- [x] Vue globale analytique (Volume, CA Brut/Net) — **livrée le 2026-09-27** : écran `src/pages/Analytics.tsx`,
  route `/analytics`, lien dans la sidebar. Par tenant et au total, sur le mois en cours / 30 jours / 12 mois :
  courses (terminées, annulées), encaissé, remboursé, CA brut TTC, CA net HT, TVA collectée. Agrégats calculés
  en base par `platform_tenant_analytics(p_from, p_to)` (migration `20260927031429`, `SECURITY INVOKER`, réservée
  aux rôles plateforme, ligne de total par `GROUPING SETS`) — aucun calcul financier côté client.
  Testée : cas chiffrés sur base locale (paiement + remboursement), et `tests/superadmin-analytics.spec.ts`
  (agrégats comparés à un calcul indépendant sur le ledger de prod, écran, refus hors rôle plateforme).

- [x] Approbation / rejet des dossiers d'onboarding — `src/pages/OnboardingsList.tsx`, route `/onboardings`
  (2026-09-27). L'écran équivalent du backoffice (`/admin/onboardings`) était inaccessible depuis la séparation :
  le middleware renvoie les admins plateforme vers l'accueil (ADR-009). **Aucun onboarding n'était approuvable
  par un humain.** `approve_onboarding_tx` vérifie désormais elle-même le `platform_role` de l'appelant
  (migration `20260926222114`) et est ouverte à `authenticated`.

**Fait le 2026-09-27 :** liens morts Analytics / Utilisateurs retirés de la sidebar (vraies routes via `NavLink`),
couleurs passées sur des tokens sémantiques (`src/index.css`), lint à zéro. La section `/admin/*` du backoffice,
morte, est supprimée (pages, `/api/admin/*`, `components/admin/*`, `AdminLayout.astro`).

**Reste à faire :** rien. Pour mémoire, les anciennes pages admin du backoffice (réservations, grand livre,
monitoring Stripe) n'ont pas d'équivalent superadmin ; récupérables dans l'historique git (`59e7fe1^`) si le
besoin apparaît.

### Phase 5: Refonte Design Complète UI/UX (Backoffice Uniquement)
**Status:** Complete
**Goal:** Sublimer l'interface d'administration avec les standards "Impeccable & Taste"
**Requirements**:
- Refonte totale des couleurs et typographies du Backoffice (Dashboard).
- Amélioration des micro-interactions et de la hiérarchie visuelle.
- Application stricte des principes esthétiques haut de gamme pour l'outil de gestion.

### Phase 6: Câblage Data Drivers Front (Tunnels)
**Status:** Complete
**Goal:** Rendre les 4 tunnels de réservation fonctionnels avec la base de données
**Requirements**:
- Tunnel Transfert : Récupération des prix fixes via supabase RPC.
- Tunnel Longue Distance : Calcul kilométrique dynamique (A/R, distance).
- Tunnel Excursions (Mise à dispo) : Focus tourisme avec options spécifiques (Guide/Traducteur).
- Tunnel B2B (Business) : Focus attente point fixe avec facturation entreprise (SIRET/TVA).
- Intégration paiement Stripe simulé (en attente refonte API).

### Phase 7: Refonte UI Tunnels (Composants Réutilisables)
**Status:** Complete
**Goal:** Nettoyer et factoriser le code frontend des tunnels de réservation
**Requirements**:
- [x] Extraire `<ContactForm />` (Etape 4) pour gérer les formulaires B2C et B2B proprement — `components/tunnels/steps/ContactStep.astro`.
- [x] Extraire `<VehicleGrid />` (Etape 2) pour l'affichage dynamique des gammes — `components/tunnels/steps/VehicleGridStep.astro`.
- [x] Extraire `<DateTimePicker />` pour la gestion des dates — `components/tunnels/steps/DateTimePicker.astro`, variantes natif + flatpickr, utilisé par les 4 tunnels.
- [x] Créer un script unifié `tunnel-core.js` pour la gestion d'états (Step-by-Step) — `src/core/tunnel-core.ts`.

**Note de périmètre :** le fichier `phases/07-refonte-ui-drivers-front/07-PLAN.md` décrivait en plus une refonte
graphique « Cyber-Luxe » (fond `#0a0a0a`, Plus Jakarta Sans, glow). Cette direction artistique a été **abandonnée**
au profit de la DA « steel blue » (`#0B0F15` / `#151F2B`) livrée entre les commits `b71db2a` et `3b8aa3b`.
Le volet design de la Phase 7 est donc clos par substitution, pas par exécution du plan d'origine.

### Phase 8: Facturation et Comptabilité (ERP Professionnel)
**Status:** Clos le 2026-09-27 avec reports (voir « Clôture du milestone V1 ») — était Mostly Complete (livrée hors process de planification — aucun 08-PLAN.md n'a existé)
**Goal:** Ajout des fonctionnalités d'édition
**Requirements**:
- [x] Génération des factures PDF automatiques — edge function `supabase/functions/generate-invoice` (pdf-lib),
  appelée depuis `ImmediateActions.tsx` et `scripts/bookings.ts`. Numérotation via migration `20260629000004_invoice_sequences.sql`,
  stockage bucket `invoices` (`20260629000001`). Bonus non planifié : `generate-devis`.
- [x] Rapports mensuels — `apps/vtc-backoffice/src/pages/app/ledger.astro` (12 mois, CA brut / net / TVA).
- [~] Export comptable — `api/tenant/export-csv.ts` fournit un CSV brut ; **aucun format normé** (FEC, Sage, Quadratus).

**Découpe fixe / calculé (2026-09-26) :** `generate-invoice` ne facture plus que les courses dont le montant
ne dépend pas d'une distance non vérifiée. Règle dans `supabase/functions/_shared/invoiceable.ts`
(`checkInvoiceable`), 5 tests `deno test` joués en CI :
- `pricing_mode = 'manual'` → facturable (montant saisi par un humain = validation).
- `booking_type = 'hourly'` → facturable (base + heures, durée contractuelle).
- `transfer` sans `distance_km` → facturable, le total retombe sur `max(base_price, minimum_fare)` = forfait fixe.
- `transfer` avec `distance_km > 0` → **refus 409 `price_not_validated`**, le montant doit d'abord être validé
  à la main (la course passe alors en `pricing_mode = 'manual'`).

Le guard est placé **avant** `next_invoice_number` : un refus ne consomme pas de numéro, la séquence reste continue.
Aucune migration : le discriminant `pricing_mode` existait déjà (`20260318122732`). Le statut `pending_quote`
prévu par `phases/PLAN-X-STRIPE-DYNAMIC.md` devient donc inutile — ce plan est à relire à la lumière de ça
(il suppose aussi un `booking_type_enum` à trois valeurs, alors que l'enum réel ne vaut que `transfer | hourly`).

Défaut corrigé au passage : les deux appelants (`ImmediateActions.tsx`, `scripts/bookings.ts`) affichaient
`err.message` d'un `FunctionsHttpError`, soit toujours « Edge Function returned a non-2xx status code ».
Le message métier du corps de réponse était perdu. Helper `src/lib/function-error.ts`.

**Reste à faire :**
- Restaurer le flux Stripe Invoicing dans `generate-invoice` (bypass actuel documenté par le commentaire `ponytail:` en tête du fichier — PDF local, `paid_out_of_band` cassé par un réglage d'auto-encaissement du compte connecté de démo). **Bloquant avant prod réelle.** Code retiré récupérable : `git show 16133a8^:supabase/functions/generate-invoice/index.ts`. Préalable non-code : élucider le réglage Settings > Invoicing du compte connecté de démo.
- **Câbler ORS (OpenRouteService) pour la distance et l'estimation de péage.** Choix tranché le 2026-09-26 :
  ORS plutôt qu'OSRM, parce qu'il expose `avoid_features: ["tollways"]` et `extra_info=tollways` sans
  recompiler les données, là où OSRM demande de modifier le profil `car.lua`. Google Maps Distance Matrix
  n'est pas nécessaire. À faire quand le volume de longue distance le justifiera.

  **Estimation du péage — formule retenue :** `km_à_péage × toll_rate_per_km`, et **non**
  `coût_moyen × nombre_de_passages`. Raison : `extra_info=tollways` renvoie des *segments* à péage, pas des
  barrières, et le réseau français concédé est majoritairement en système fermé (ticket à l'entrée, paiement
  à la sortie selon la distance parcourue). Compter les passages se tromperait d'un ordre de grandeur —
  un Paris-Marseille fait peu de passages pour ~60 €, un tronçon urbain à barrière pleine voie fait un
  passage pour ~2 €.

  `toll_rate_per_km` doit être un **réglage tenant**, pas une constante : ordre de grandeur 0,09–0,11 €/km
  pour un véhicule léger (classe 1), à calibrer sur les tickets réels. Ni ORS ni OSRM ne donnent de montant
  de péage — seules des sources dédiées le font (TollGuru, HERE Routing, Google Routes API), toutes payantes
  au-delà d'un quota, et écartées pour cette raison.

  Le péage estimé reste une **ligne distincte** du prix de la course, jamais fondu dans `total_amount` :
  une estimation ne doit pas contaminer un montant facturé. L'alternative sans aucune API — péages inclus
  dans `price_per_km`, ou refacturés en débours au réel sur justificatif — reste valable et moins coûteuse.
- [x] **Typage des Edge Functions assaini le 2026-09-27** : `generate-invoice` passe de 80 erreurs `deno check` à 0
  (les `select()` concaténés empêchaient `supabase-js` d'inférer les champs ; passés en chaînes littérales),
  `generate-devis` de 72 à 0 (même cause). Corrigés aussi : `accept-booking` (erreur non typée dans le `catch`),
  `cancel-booking` et `create_refund` (import esm.sh de Stripe en `no-check`, donc sans types), et les trois
  fonctions Stripe Connect (`create-account-link`, `create-connect-account`, `create-stripe-onboarding`), qui
  importaient `npm:stripe` **sans version** : épinglées sur `npm:stripe@16`, le SDK de l'`apiVersion` `2024-06-20`
  qu'elles déclarent. Aucun changement de logique ; l'épinglage ne prendra effet qu'au prochain déploiement de
  ces fonctions (non redéployées ce jour).
  - Nouvelle étape CI `Typecheck edge functions` (`deploy.yml`) : chaque fonction vérifiée avec son propre
    `deno.json`, comme le fait `config.toml`. Les 14 fonctions passent.
- Export comptable à un format normé si l'expert-comptable l'exige.

### Phase 9: Multi-Driver et Permissions Avancées
**Status:** Clos le 2026-09-27 avec reports (voir « Clôture du milestone V1 ») — était Mostly Complete (livrée hors process de planification — aucun 09-PLAN.md n'a existé)
**Goal:** Gérer les flottes de chauffeurs
**Requirements**:
- [x] Gestion multi-chauffeurs pour un seul tenant — table `drivers`, UI `components/drivers/DriverList.tsx` + `DriverModal.tsx` montées dans `app/profile.astro`.
- [x] Assignation précise des courses — `driver_id` posé par `api/tenant/create-booking.ts` et l'edge function `accept-booking`.
- [~] Permissions fines par compte — enum `tenant_role` (owner / manager / driver / pending), helpers `src/lib/guards.ts`
  (`requireTenantRole` / `hasTenantRole`), nav filtrée par rôle dans `AppLayout.astro`, guards sur `settings.astro` (owner),
  `pricing.astro` (owner+manager), `ledger.astro` et `api/tenant/export-csv.ts` (owner+manager, ajoutés le 2026-09-24).
  filtrage `.eq("driver_id", …)` sur `bookings.ts` / `search-bookings.ts` (périmètre des données).
  **Guards centralisés le 2026-09-25** : `ROUTE_POLICY` dans `src/lib/guards.ts` déclare les rôles autorisés
  pour les 8 pages `/app/*` et les 8 routes `/api/tenant/*`, appliquée dans `middleware.ts` (section 2ter),
  en deny-by-default. `scripts/check-route-policy.mjs` échoue si un chemin n'est pas déclaré (step CI dans `deploy.yml`).

  **Correction d'un constat faux :** la version précédente de cette ligne affirmait un « cloisonnement du rôle
  `driver` dans `middleware.ts` ». Il n'existait pas : le middleware laissait tous les rôles tenant sur la
  totalité de `/app/*`. Les seules occurrences de `driver` y servaient à prolonger la session en course.

**Périmètre réduit au 2026-09-24 (décision utilisateur) :** le produit démarre en **chauffeur solo**.
Le socle multi-chauffeurs (table `drivers`, `driver_id` sur bookings, enum `tenant_role`) reste en place
car il a été pensé dès l'origine, mais son exploitation réelle — invitation de membres, attribution du rôle
`manager`, assignation entre plusieurs chauffeurs — est **reportée à un milestone dédié** (voir Phase 999).
Le mode solo est déjà le chemin nominal : `approve_onboarding_tx` crée le tenant, passe le profil en `owner`
et crée le driver titulaire avec le `user_id` de l'owner, plus le véhicule.

**Faille fermée le 2026-09-25 :** `api/tenant/update-settings.ts` et `update-logo.ts` n'avaient aucun contrôle
de rôle alors que `app/settings.astro` était gardé `owner`. Un `driver` authentifié pouvait donc réécrire les
réglages et le logo du tenant en appelant l'API directement — le guard de la page était contournable.
C'est la raison du choix d'un point d'application unique (middleware) plutôt que d'un guard par page.

**Reste à faire :**
- Aucun code n'attribue jamais `tenant_role = 'manager'` : le rôle est défini, gardé, mais inerte faute d'écran
  d'invitation/gestion des membres du tenant. **Assumé** tant qu'on est en solo.
- [x] **Guards redondants retirés le 2026-09-27** : `requireTenantRole` dans `ledger.astro`, `pricing.astro`,
  `settings.astro` et `hasTenantRole` dans `api/tenant/export-csv.ts` (la ligne précédente de cette roadmap disait
  ce dernier déjà retiré : c'était faux). Les deux fonctions, devenues mortes, sont supprimées de `lib/guards.ts`.
  `ROUTE_POLICY` est désormais l'unique source de vérité applicative.
  - Trou fermé au passage : un compte `pending` ou sans rôle atteignait `/api/tenant/*` (la section 3 du
    middleware ne redirige que les pages). Le middleware répond maintenant 403.
  - Boucle fermée au passage : un driver d'un tenant au setup inachevé tournait entre `/app/dashboard` (qui
    renvoie au setup) et `/app/setup` (refusé au driver). Seul l'owner est renvoyé au setup.
  - Vérifié sur base locale, backoffice en dev, matrice owner / driver / pending × 4 pages + 2 routes API.
- Les guards sont applicatifs : la RLS ne distingue pas les rôles au sein d'un tenant (voir Phase 10).

### Phase 11: Réparation onboarding et conformité TVA
**Status:** Complete — appliquée en production le 2026-09-26 (version `20260926003805`), approbation réelle rejouée le 2026-09-27
**Goal:** Rendre l'approbation d'onboarding à nouveau fonctionnelle et les factures fiscalement conformes.

Migration `20260926000000_restore_tenant_legal_fields_and_vat_sync.sql`. Deux régressions cumulées,
toutes deux dues à `20260531200000` (correction du lien `drivers.user_id`) qui a redéfini
`approve_onboarding_tx` en repartant d'une version périmée :

- **BLOQUANT** — le bloc « Créer le véhicule » lit `o.vehicle_brand` / `o.vehicle_model` / `o.plate_number`,
  colonnes supprimées de `onboarding` deux mois plus tôt par `20260328193200_onboarding_v4_clean.sql:13-15`.
  PL/pgSQL ne compile le corps qu'à l'exécution : la fonction se crée sans erreur et échoue au premier appel.
  **Plus aucun onboarding n'était approuvable depuis le 2026-05-31.** Le bloc est supprimé, pas réparé :
  le véhicule est créé par `app/setup.astro:62-76`, avec des champs que l'onboarding ne collecte plus.
- **FISCAL** — `20260401183000` propageait `siret` / `legal_form` / `company_type` / `setup_completed` ;
  l'INSERT régressé se limitait à `(id, name, primary_domain, email, phone)`. Le tenant naissait avec
  `legal_form` NULL, donc les deux triggers de synchro TVA restaient muets et les valeurs par défaut
  s'appliquaient (`vat_rate = 0`, `is_vat_exempt = true`). Une SASU assujettie émettait des factures
  **sans TVA, sans SIRET, et portant la mention « Art. 293 B CGI »** réservée à la franchise en base.

Le backfill reprend `legal_form` et `siret` depuis le dossier d'onboarding de l'owner pour les tenants
déjà créés par la version régressée.

**Aucun trigger créé** : `trg_set_tenant_vat_on_insert` (`20260531000000_vat_on_insert.sql`) couvrait déjà
l'INSERT. Il n'a jamais rien fait parce que la régression, arrivée 20 h plus tard le même jour, lui envoyait
`legal_form` à NULL.

**Validation locale du 2026-09-26** (`supabase db reset --no-seed` sur base reconstruite depuis
`supabase/migrations/`, les 40+ migrations rejouées sans erreur) :
- `supabase/lint/security_checks.sql` : *Schema security lint passed*.
- **Régression reproduite** : en restaurant la définition de `20260531200000`, l'appel échoue sur
  `ERROR: column o.vehicle_brand does not exist`, `PL/pgSQL function approve_onboarding_tx(uuid) line 54`.
  Le diagnostic est donc prouvé, pas supposé.
- **Correctif vérifié de bout en bout** : approbation d'un dossier SASU → tenant créé avec
  `legal_form = sasu`, `company_type = societe`, `siret` renseigné, `is_vat_exempt = false`, `vat_rate = 10`,
  `setup_completed = false` ; profil passé `owner` ; driver titulaire créé et lié au `user_id` de l'owner.

**Reste à faire :**
- ~~Appliquer la migration en production~~ — fait le 2026-09-26, version `20260926003805` (fichier renommé en
  conséquence, drift nul). Reprise vérifiée : 0 tenant sans `legal_form`.
- ~~Rejouer une approbation d'onboarding réelle~~ — fait le 2026-09-27 par `tests/onboarding-approval.spec.ts`
  (projet Playwright `superadmin`) : clic sur « Approuver » dans superadmin, en production, puis vérification
  `legal_form = sasu`, `company_type = societe`, SIRET, TVA 10 %, rôle `owner`, driver titulaire. Données
  jetables supprimées en fin de test.

**Constats du 2026-09-27 :**
- `tests/backoffice.spec.ts` n'a jamais exercé l'approbation : il passait le dossier en `approved` puis insérait
  lui-même tenant, profil et driver. Il appelle désormais `approve_onboarding_tx`. Son nettoyage échouait en
  silence (FK `bookings -> tenants` sans cascade) : **13 tenants « VTC E2E Corp » et 12 courses de test**
  s'étaient accumulés en production depuis le 2026-06-17. Supprimés, ainsi que 2 comptes de test orphelins.
- `onboarding_insert_own` / `onboarding_update_own` laissaient un utilisateur fixer lui-même `status = approved`.
  Fermé par `20260927015049` : création et mise à jour imposent `pending`, un dossier approuvé n'est plus
  modifiable par son propriétaire.
- [x] **Doublon TVA fusionné le 2026-09-27** (migration `20260927030100`) : `set_tenant_vat_on_insert` et
  `sync_tenant_vat_config` remplacées par une seule fonction `sync_tenant_vat()` et un seul trigger
  `trg_sync_tenant_vat` (`BEFORE INSERT OR UPDATE OF legal_form`). Comportement identique prouvé sur base locale
  (8 cas avant/après : création, bascule de forme, override manuel conservé, forme nulle), appliqué en prod.
- **Dette fiscale connue :** le taux 10 % est dérivé de `legal_form`, jamais saisi. Un auto-entrepreneur qui
  franchit le seuil de franchise en base reste auto-entrepreneur mais devient assujetti — le trigger le force
  pourtant en exonéré dès qu'on touche `legal_form`, et rien dans l'UI ne permet de le déclarer assujetti.
  Décision utilisateur du 2026-09-26 : **laissé en l'état** tant qu'on démarre en solo. À rouvrir au premier
  tenant concerné, en dissociant l'assujettissement de la forme juridique.

## Clôture du milestone V1 (2026-09-27)

Phases 1 à 12 closes. Ce qui n'a pas été livré n'est pas oublié : chaque point est reporté explicitement
ci-dessous, avec sa destination.

### Phase 12: Correctifs sécurité critiques (clé anon)
**Status:** Complete — appliquée en production le 2026-09-27 (migration `20260927023037`)
**Goal:** Fermer les écritures que la clé publique `anon` (présente dans le bundle de chaque site tenant) permet.
**Constats du 2026-09-27** (policies lues en prod, exploitation vérifiée sur base locale dans une transaction annulée) :
- `platform_settings` : policy `platform_settings_update_admin` en `UPDATE USING (true)` pour `public`, et
  `anon` a le droit UPDATE → **n'importe qui peut réécrire les taux de commission plateforme.** Vérifié.
- `bookings` : `insert_bookings_public` (`anon`, `WITH CHECK original_tenant_id IS NOT NULL`) → **n'importe qui
  peut insérer une course `status = paid` chez n'importe quel tenant ; `trg_auto_financial_movement`
  (SECURITY DEFINER) écrit alors une recette dans `financial_movements`, ledger immuable.** Vérifié : une ligne
  `payment credit 9999.00` créée par `anon`.
- `customers` : `insert_customers_public` → n'importe qui peut créer des clients chez n'importe quel tenant.
- `platform_settings_read_admin` en `SELECT USING (true)` : taux de commission lisibles par tous (à qualifier).
**Requirements:**
- [x] `platform_settings` : SELECT et UPDATE réservés à `super_admin` (aucun code applicatif ne lit la table).
- [x] Supprimer `insert_bookings_public` et `insert_customers_public` ; droits INSERT/UPDATE/DELETE/TRUNCATE
  révoqués à `anon` sur `platform_settings`, `bookings`, `customers`. Aucun flux légitime ne les utilise :
  les réservations payantes sont créées par les Edge Functions (`create_checkout_session`, `stripe_webhook`)
  en `service_role`.
- [x] `auto_create_financial_movement` refuse (42501) un encaissement produit par un client `anon` ou
  `authenticated` : seul `service_role` alimente le ledger. Toutes les transitions légitimes passent déjà par
  `createAdminClient()` ou les Edge Functions.
- [x] Grand livre de production vérifié : aucune trace d'exploitation. 3 mouvements « stripe_payment » sans
  `stripe_payment_intent_id`, tous du 2026-07-29 sur les tenants de démo (Elite Lyon, VTC Elite Demo, créé ce
  jour-là) : données de démonstration, laissées en place (ledger immuable). `platform_settings` inchangée
  depuis le 2026-03-04.
- [x] Formulaire de devis du site public supprimé (`core/booking.ts`, `api/quote.ts`) : appelé par aucune page
  et cassé (colonne `client_name` inexistante). À recréer via une Edge Function si le besoin revient.
- [x] Lint `supabase/lint/security_checks.sql`, règle 4 : une policy d'écriture sans condition (`true`) ouverte à
  `anon`/`public` fait échouer la CI. Limite : une condition triviale mais non littérale (ex. l'ancien
  `original_tenant_id IS NOT NULL`) n'est pas détectée — c'est le rôle des tests par rôle de la Phase 13.
- [x] Vérifié en production par l'API REST publique avec la clé `anon` : PATCH `platform_settings` → 401,
  POST `bookings` / `customers` → `42501 permission denied`.
- [x] Au passage : page `/test-booking` (catalogue de composants publié sur chaque site tenant) supprimée.

### Reports du milestone V1

| Point | Origine | Destination | Pourquoi pas maintenant |
|---|---|---|---|
| Restaurer Stripe Invoicing dans `generate-invoice` | Phase 8 | **Pré-requis de lancement**, hors V2 | Bloqué sur un réglage *Settings > Invoicing* du compte Stripe connecté de démo (côté utilisateur). **Bloquant avant une vraie prod.** |
| Protection anti-mots de passe compromis | Phase 10 | Action utilisateur (dashboard Auth Supabase) | Réglage de console, pas de code. |
| `EMAIL_FROM` absent des secrets Supabase (repli sur une adresse Gmail) | Secrets | Décision utilisateur | Il faut un expéditeur sur un domaine vérifié chez Resend. 2 envois sur 4 en échec en juillet. |
| ~~Vue analytique superadmin (volume, CA brut/net)~~ | Phase 4.5 | **Fait le 2026-09-27** | Voir Phase 4.5 : écran `/analytics`, fonction `platform_tenant_analytics`. |
| Export comptable normé (FEC, Sage…) | Phase 8 | Backlog, conditionnel | Seulement si l'expert-comptable l'exige. |
| ~~80 erreurs `deno check` dans `generate-invoice`~~ | Phase 8 | **Fait le 2026-09-27** | Les 14 Edge Functions passent `deno check`, vérifié en CI. |
| ~~Guards `requireTenantRole` redondants avec `ROUTE_POLICY`~~ | Phase 9 | **Fait le 2026-09-27** | Voir Phase 9 : guards et fonctions retirés, trou API `pending` et boucle driver/setup fermés. |
| Rôle `manager` inerte, multi-chauffeurs en exploitation | Phase 9 | Backlog (déjà) | Démarrage en chauffeur solo, décision du 2026-09-24. |
| ~~Deux fonctions de synchro TVA redondantes~~ ; assujettissement dérivé de `legal_form` | Phase 11 | Fusion **faite le 2026-09-27** ; assujettissement : backlog | Assujettissement : décision utilisateur du 2026-09-26, à rouvrir au premier auto-entrepreneur assujetti. |
| ~~Tests E2E Playwright écrivant en production~~ | Phase 11 | **Fait le 2026-09-27** | `tests/e2e-env.ts` : cible locale par défaut (`.env.e2e`, modèle `.env.e2e.example`), toute autre cible refusée sans `E2E_ALLOW_PRODUCTION=1`. Limite : l'API admin Auth de la stack locale refuse les jetons HS256 avec la CLI Supabase 2.75 — mettre la CLI à jour (2.118) pour jouer les tests en local. |
| ~~`RatingQRModal.tsx` appelle `useState` après un `return` conditionnel~~ | Constat 2026-09-27 | **Fait le 2026-09-27** | URL calculée au rendu, plus d'état ni d'effet. |
| `PUBLIC_SITE_URL`, `PUBLIC_SITE`, `PUBLIC_TENANT_ID` absents de Terraform | Secrets | **Clos, sans objet** | `PUBLIC_SITE` ne sert qu'en dev ; `PUBLIC_TENANT_ID` est un repli après résolution par domaine ; `PUBLIC_SITE_URL` retombe sur l'origine du backoffice, qui héberge `/rate/[id]`. |

## Milestone V2 — Backoffice React + PWA temps réel (planifié le 2026-09-27)

Décision d'architecture : `docs/decisions/vtc-backoffice/ADR-011-backoffice-react-spa-pwa-temps-reel.md`
(statut Proposé). Point d'entrée : **Phase 13**. Ordre imposé : **la sécurité descend en base avant que le client ne change** — tant que les
rôles ne sont que dans le middleware Astro, une SPA exposerait tout ce que la RLS laisse passer.

| Phase | Objet | Charge | Dépend de |
|---|---|---|---|
| 13 | Rôles tenant dans la RLS | 5–7 j | clôture V1 |
| 14 | Routes serveur → RPC / Edge Functions | 4–5 j | 13 |
| 15 | Socle données temps réel | 3–4 j | 13 |
| 16 | Pages en React (îlots dans Astro) | 9–12 j | 14, 15 |
| 17 | Bascule SPA + PWA | 4–5 j | 16 |
| 18 | Web Push (arrière-plan) | 3–4 j | 15, 17 |
| **Total** | | **≈ 28–37 j (6–8 semaines)** | |

Chaque phase est livrable seule et mise en production avant la suivante. Aucune phase n'est lancée sans
`NN-PLAN.md` détaillé (`/gsd-plan-phase NN`).

### Phase 13: Rôles tenant dans la RLS
**Status:** Not started
**Goal:** Que les droits de `ROUTE_POLICY` soient vrais en base, quel que soit le client qui appelle.
**Constats du 2026-09-27** (policies de prod) :
- `pricing_rules` (`pricing_isolation`, `pricing_tenant_isolation`), `vehicles` (`vehicles_isolation`,
  `vehicles_tenant_isolation`), `drivers` (`drivers_isolation`, `drivers_tenant_isolation`) : `FOR ALL` pour
  **tout membre du tenant** → un driver peut modifier tarifs, véhicules et chauffeurs, alors que `ROUTE_POLICY`
  les réserve à owner/manager.
- `drivers_insert_owner_only` est **sans effet** : les policies étant permissives (OR), `drivers_isolation`
  (sans `WITH CHECK`, donc `USING` réutilisé) autorise déjà l'INSERT à tout membre.
- `bookings` : UPDATE ouvert à tout membre sur toutes les courses du tenant ; un driver peut modifier les courses
  d'un autre, et `total_amount` tant que la course est `pending` (`protect_booking_immutable_fields`).
  Règle du projet : aucun calcul financier côté client.
- Policies en doublon (4 SELECT sur `bookings`, 2 `FOR ALL` sur `drivers`, `vehicles`, `pricing_rules`, 3 SELECT
  plateforme sur `financial_movements`) : la plus permissive gagne toujours, ce qui rend la relecture trompeuse.
**Requirements:**
- [ ] Fonction `current_tenant_role()` (STABLE, `SECURITY DEFINER`, `search_path` figé) sur le modèle de
  `current_tenant_id()`.
- [ ] Matrice rôle × table × opération écrite **avant** les migrations, dérivée de `ROUTE_POLICY` ; la faire
  valider (notamment : le manager écrit-il les tarifs ? le driver voit-il les courses non assignées ?).
- [ ] Réécrire les policies par table et par commande (plus de `FOR ALL`), supprimer les doublons.
- [ ] `bookings` : le client n'écrit plus de colonnes financières ni de statut en direct ; transitions via RPC
  (Phase 14). Driver limité à ses courses (`driver_id`).
- [ ] Suite de tests SQL jouée en CI (`db-lint.yml`) : pour chaque rôle, chaque opération autorisée passe et
  chaque opération interdite échoue — sur le modèle de la validation locale de la Phase 11.
- [ ] Une fois la RLS en place, `ROUTE_POLICY` ne sert plus qu'à la navigation (UX), plus à la sécurité.

### Phase 14: Routes serveur → RPC / Edge Functions
**Status:** Not started
**Goal:** Plus aucune logique métier ni clé `service_role` dans le serveur Astro du backoffice.
**Requirements:**
- [ ] Inventaire des 11 routes (`api/tenant/*` ×8, `api/missions/terrain-transition`, `api/submit-rating`,
  `api/auth/login`) et des 10 fichiers qui appellent `createAdminClient()` ; pour chacun : RPC (logique de
  données, transaction) ou Edge Function (appel externe : Stripe, e-mail, stockage).
- [ ] Transitions de course (`booking-actions`, `update-booking-status`, `terrain-transition`) en RPC uniques et
  idempotentes, gardées par rôle, s'appuyant sur `trg_validate_booking_status_transition` ; règle H-15 d'ADR-002
  conservée côté serveur.
- [ ] `create-booking` : prix calculé côté serveur uniquement (règle du projet).
- [ ] `api/submit-rating` et `rate/[id]` (page publique client) : déplacer vers `vtc-websites`.
- [ ] `api/auth/login` : remplacé par `signInWithPassword` côté client (Phase 17).
- [ ] Retirer `SUPABASE_SERVICE_ROLE_KEY` de `backoffice_env_vars` (Terraform) en fin de phase.

### Phase 15: Socle données temps réel
**Status:** Not started
**Goal:** Que tout écran du backoffice reflète en quelques secondes un changement fait ailleurs
(webhook Stripe, client, autre chauffeur), sans rechargement.
**Requirements:**
- [ ] Colonne `bookings.updated_at` + trigger (absente aujourd'hui) : sert à ordonner les événements et à
  détecter les écritures concurrentes.
- [ ] Trigger `realtime.broadcast_changes` sur `bookings` (INSERT, changements de `status`, `mission_status`,
  `driver_id`) vers le topic privé `tenant:<tenant_id>:bookings`. Payload minimal
  `{id, status, mission_status, driver_id, updated_at}`.
- [ ] RLS sur `realtime.messages` : seul un membre du tenant s'abonne à son topic ; un driver ne reçoit que les
  événements utiles à son périmètre (à trancher avec la matrice de la Phase 13).
- [ ] Package partagé (backoffice + superadmin) : `QueryClient` TanStack Query, hook `useTenantBookingsRealtime`
  qui invalide/patche le cache ; événement plus ancien que le cache (`updated_at`) ignoré.
- [ ] Resynchronisation complète sur `visibilitychange` (retour au premier plan), `online`, et réabonnement
  (`SUBSCRIBED` après coupure) ; sondage de secours à 60 s, premier plan uniquement.
- [ ] Indicateur visible de l'état de synchronisation (connecté / reconnexion / hors ligne).
- [ ] Événements couverts : nouvelle course payée (`stripe_webhook`), annulation client (`cancel-booking`),
  paiement expiré, échec de remboursement, acceptation, assignation, étapes terrain.
- [ ] Corriger ADR-002 (« implémenté » alors qu'aucun canal n'existe) par un ADR qui le remplace.

### Phase 16: Pages en React (îlots dans Astro)
**Status:** Not started
**Goal:** Supprimer les scripts DOM impératifs ; chaque page devient un composant React branché sur le socle
temps réel. Livrable page par page.
**Requirements:**
- [ ] `bookings` en premier (977 + 1 100 lignes de script, et la page la plus concernée par l'asynchrone).
- [ ] Puis `dashboard`, `setup`, `pricing`, `ledger`, `settings`, `profile`, `vehicles`, et le layout `AppLayout`.
- [ ] Puis `signup`, `login`, `waiting-approval`, `onboarding`.
- [ ] Tokens de couleur sémantiques partagés avec superadmin ; réutiliser les 11 composants React existants.
- [ ] Tests E2E par page migrée (Playwright), sur une base de test — **pas la production** (voir constat Phase 11).

### Phase 17: Bascule SPA + PWA
**Status:** Not started
**Goal:** Backoffice statique (Vite + React Router), installable, à jour sans action du chauffeur.
**Requirements:**
- [ ] Enveloppe Vite + React Router ; Astro retiré du backoffice ; déploiement Cloudflare Pages en SPA.
- [ ] Session : `supabase-js` côté client ; CSP stricte (le jeton vit dans le navigateur).
- [ ] Manifest (nom, icônes, `display: standalone`, couleurs des tokens) ; écran d'aide à l'installation iOS.
- [ ] Service worker (`vite-plugin-pwa`, Workbox) : coquille en cache, données en *network-first*,
  **jamais** de réponse d'écriture en cache.
- [ ] Mise à jour en mode `prompt` : bandeau « nouvelle version », appliquée hors action en cours.
- [ ] Hors ligne en lecture seule : courses du jour consultables, actions désactivées avec message explicite.
- [ ] Terraform et CI mis à jour ; `backoffice.spec.ts` réécrit.
- [ ] Quick win possible dès maintenant, indépendant de tout le reste : manifest seul (app installable), ½ j.

### Phase 18: Web Push (arrière-plan)
**Status:** Not started
**Goal:** Prévenir le chauffeur d'un événement qui exige une action quand l'app n'est pas ouverte.
**Requirements:**
- [ ] Table `push_subscriptions` (RLS : l'utilisateur gère les siennes) ; clés VAPID en secret Supabase.
- [ ] Edge Function `send-push` ; déclenchée côté serveur (trigger → `pg_net` ou webhook de base) sur : nouvelle
  course, annulation client, échec de paiement ou de remboursement, assignation.
- [ ] Clic sur la notification : ouvre la course concernée ; l'app se resynchronise à l'ouverture (Phase 15).
- [ ] Préférences de notification par utilisateur ; nettoyage des abonnements expirés (réponse 404/410).
- [ ] iOS : push seulement pour la PWA installée (≥ 16.4), après consentement — parcours documenté dans l'app.

### Phase 999: Backlog / Future (V4)
- ~~Migration du backoffice en React pur~~ — planifiée le 2026-09-27 : Milestone V2, Phases 12 à 18.
- **Intégration ORS (distance + estimation de péage)** — décidée le 2026-09-26, non planifiée.
  Tâches : client ORS côté serveur (jamais côté client, cf. règle « aucun calcul financier côté client ») ;
  récupération `distance_km` et longueur des segments `tollways` ; réglage tenant `toll_rate_per_km` ;
  affichage du péage estimé en ligne séparée ; bascule des transferts kilométriques de
  `price_not_validated` vers facturable une fois la distance vérifiée par ORS.
  Détail de la formule et du raisonnement : voir Phase 8, « Reste à faire ».
- **Multi-chauffeurs en exploitation réelle** (sorti de la Phase 9 le 2026-09-24) : écran de gestion des membres
  du tenant, invitation par e-mail, attribution du rôle `manager`, assignation d'une course entre plusieurs
  chauffeurs, permissions fines owner vs manager. Le socle base de données existe déjà.
- Parrainage contrôlé
- Réseau et cercle d'entreprises (Partage de courses)
- Commissionnement réseau


### Phase 10: Durcissement RLS et alignement prod
**Status:** Complete (appliqué en production le 2026-09-25)
**Goal:** Refermer l'écart entre les migrations locales et la base `vtc-demo-production`, et rendre la RLS
cohérente avec les rôles tenant.
**Résultat après application :** les 3 ERROR du linter sont fermées. Restent, assumés :
l'INFO `cancellation_policies` (RLS activée sans policy), les WARN sur `get_available_vehicles`,
`get_public_tenant` et `get_public_booking_result` (publiques par conception), sur
`delete_tenant_account` et `get_fiscal_summary` (appelées avec le JWT utilisateur, la seconde
vérifiant elle-même le tenant), et la protection anti-mots de passe compromis, à activer
dans le dashboard Auth.

**Piège rencontré :** les `REVOKE EXECUTE ... FROM anon, authenticated` de `20260924120200`
n'ont eu aucun effet — Postgres accorde EXECUTE au pseudo-rôle `PUBLIC` à la création d'une
fonction, et révoquer un rôle nommé n'enlève pas un droit hérité de `PUBLIC`. Corrigé par
`20260925090000_revoke_execute_from_public.sql`.

**Constats initiaux (linter Supabase, 2026-09-24, projet `kpnkhmtxzigxtfnkmzru`) :**
- **4 migrations locales ne sont pas appliquées en prod.** La dernière version en base est `20260729091936`.
  Non appliquées : `20260729221500_fix_auth_users_exposed_view`, `20260729221600_enable_rls_invoice_sequences`,
  `20260921000000_security_hardening`, `20260922000000_tenant_status_kill_switch`. Le Kill Switch de la Phase 4.5
  est donc **inactif en production**.
- **ERROR `security_definer_view` × 8**, dont `tenant_accounting_ledger` : la vue n'a pas `security_invoker=true`,
  donc la policy `finance_select_isolated` de `financial_movements` ne s'applique pas. L'isolation par tenant
  ne repose que sur le `.eq("tenant_id", …)` applicatif de `ledger.astro`. Les 7 autres vues sont à qualifier.
- **ERROR `auth_users_exposed`** : `onboarding_admin_view` expose `auth.users` au rôle `anon`.
- **ERROR `rls_disabled_in_public`** : `invoice_sequences` sans RLS (correctif déjà écrit, juste non appliqué).
- **WARN** : 6 fonctions à `search_path` mutable, 9 fonctions `SECURITY DEFINER` exécutables par `anon`
  (dont `approve_onboarding_tx`, `delete_tenant_account`, `initiate_refund`, `next_invoice_number`),
  protection anti-mots de passe compromis désactivée.

### Outillage — Lint (mis en place le 2026-09-24)
- `supabase/lint/security_checks.sql` : lint sécurité du schéma, joué par `.github/workflows/db-lint.yml`
  sur une base locale reconstruite depuis `supabase/migrations/`. Échoue sur une vue `public` en SECURITY DEFINER,
  une table `public` sans RLS, une fonction SECURITY DEFINER à `search_path` mutable. Allowlists vides.
- ESLint (`eslint.config.mjs`, script racine `pnpm lint`, step dans `deploy.yml`) sur `vtc-backoffice` et
  `vtc-websites`, correctness uniquement. **Dette résorbée le 2026-09-25** : 0 warning, `no-unused-vars` et
  `no-useless-assignment` sont passées en `error`. Le nettoyage a révélé deux vrais défauts, corrigés :
  la meta description SEO de `services.astro` n'était jamais transmise à `BaseLayout`, et `app/dashboard.astro`
  exécutait 8 requêtes Supabase mortes à chaque chargement. `tailwind.config.mjs` (mort) et sa dépendance
  `@park-ui/tailwind-plugin` ont été supprimés.
- **Drift des migrations** (livré le 2026-09-25, commit `8c54251`) : job `migration-drift` de
  `.github/workflows/db-lint.yml`, `scripts/check_migration_drift.py`, secret `SUPABASE_ACCESS_TOKEN`.
  Piège : une migration appliquée par l'API est enregistrée sous l'horodatage d'application, pas celui du
  fichier — renommer le fichier sur la version enregistrée, sinon le job signale un faux écart.

### Secrets — répartition (clarifiée le 2026-09-25)
Trois hébergements, trois magasins distincts :
- **Cloudflare Pages** (runtime SSR) ← Terraform. `base_env_vars` pour les trois projets,
  `backoffice_env_vars` ajoute `SUPABASE_SERVICE_ROLE_KEY` au seul backoffice.
- **Supabase Edge Functions** ← secrets du projet Supabase. `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY` y vivent, vérifiés présents. Le backoffice ne fait
  qu'appeler `functions.invoke` : il n'a jamais eu besoin de ces clés, elles ont été retirées de Terraform.
- **GitHub Actions** ← secrets du dépôt. `SUPABASE_ACCESS_TOKEN` pour le drift-check.

À savoir : `EMAIL_FROM` n'est pas dans les secrets Supabase, `send-email` retombe sur son fallback en dur.

**Clos le 2026-09-27 :** `PUBLIC_SITE_URL`, `PUBLIC_SITE` et `PUBLIC_TENANT_ID` sont sans objet en production
(voir « Reports du milestone V1 »).
