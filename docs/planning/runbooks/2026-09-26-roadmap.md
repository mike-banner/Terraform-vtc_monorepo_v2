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
**Status:** Mostly Complete (corrigé le 2026-09-25 — était marquée Complete à tort)
**Goal:** Contrôler efficacement les entreprises (Tenants) via une interface isolée
**Requirements**:
- [x] Création d'une application isolée `apps/superadmin` (Port 4323) sur le modèle SaaS standard — React/Vite, `vite.config.ts:9`.
- [x] Isolation physique "Air-Gap" pour garantir la sécurité des données Master.
- [x] Validation de conformité (Kbis/VTC) et "Kill Switch" par tenant — `src/pages/TenantsList.tsx`,
  migration `20260922000000_tenant_status_kill_switch.sql`.
- [ ] Vue globale analytique (Volume, CA Brut/Net) avec stack UI optimisée (CRM) — **non livrée.**

**Reste à faire :**
- `apps/superadmin/src/App.tsx` ne déclare qu'une seule route (`TenantsList`). Les trois entrées de la sidebar
  de `src/layouts/AdminLayout.tsx` — Tenants, Analytics, Utilisateurs — sont des `href="#"` morts : l'interface
  annonce deux écrans qui n'existent pas. Soit on livre l'écran Analytics, soit on retire les liens morts.
  Le second est immédiat et arrête de mentir à l'utilisateur.

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
**Status:** Mostly Complete (livrée hors process de planification — aucun 08-PLAN.md n'a existé)
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
- `generate-invoice/index.ts` compte 80 erreurs `deno check` (77 avant cette modification) : le `select()`
  construit par concaténation empêche `supabase-js` d'inférer le type, donc tout `booking.*` remonte en
  `GenericStringError`. Dette préexistante, raison pour laquelle `supabase/functions/**` est exclu d'ESLint.
- Export comptable à un format normé si l'expert-comptable l'exige.

### Phase 9: Multi-Driver et Permissions Avancées
**Status:** Mostly Complete (livrée hors process de planification — aucun 09-PLAN.md n'a existé)
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
- Les guards `requireTenantRole` de `settings.astro`, `pricing.astro`, `ledger.astro` et `export-csv.ts` sont
  désormais redondants avec `ROUTE_POLICY`. Conservés en défense en profondeur, mais ce sont deux sources de
  vérité qui peuvent divergent : à trancher (les retirer, ou les dériver de la table).
- Les guards sont applicatifs : la RLS ne distingue pas les rôles au sein d'un tenant (voir Phase 10).

### Phase 11: Réparation onboarding et conformité TVA
**Status:** Migration écrite le 2026-09-26, **non appliquée** (non validée sur base reconstruite)
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

**Reste à faire :**
- **Appliquer et valider la migration.** Elle n'a pas pu être rejouée sur une base reconstruite en local :
  le port 54322 était occupé par un autre projet Supabase (`bati-axe`). Vérification faite par relecture et
  contrôle que chaque colonne référencée existe dans les types générés. `supabase db reset --no-seed` doit
  être joué avant application en production.
- **Tester une approbation d'onboarding de bout en bout** après application — c'est le chemin qui était cassé.
- Redondance assumée : deux fonctions font la même synchro TVA, `set_tenant_vat_on_insert` (INSERT) et
  `sync_tenant_vat_config` (UPDATE OF legal_form). À fusionner un jour, sans urgence.
- **Dette fiscale connue :** le taux 10 % est dérivé de `legal_form`, jamais saisi. Un auto-entrepreneur qui
  franchit le seuil de franchise en base reste auto-entrepreneur mais devient assujetti — le trigger le force
  pourtant en exonéré dès qu'on touche `legal_form`, et rien dans l'UI ne permet de le déclarer assujetti.
  Décision utilisateur du 2026-09-26 : **laissé en l'état** tant qu'on démarre en solo. À rouvrir au premier
  tenant concerné, en dissociant l'assujettissement de la forme juridique.

### Phase 999: Backlog / Future (V4)
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
- **Non couvert** : la détection du drift entre `supabase/migrations/` et la base distante exige un secret CI
  `SUPABASE_ACCESS_TOKEN` (+ ref projet), absent du dépôt. À ajouter pour que l'écart constaté en Phase 10
  ne puisse plus passer inaperçu.

### Secrets — répartition (clarifiée le 2026-09-25)
Trois hébergements, trois magasins distincts :
- **Cloudflare Pages** (runtime SSR) ← Terraform. `base_env_vars` pour les trois projets,
  `backoffice_env_vars` ajoute `SUPABASE_SERVICE_ROLE_KEY` au seul backoffice.
- **Supabase Edge Functions** ← secrets du projet Supabase. `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY` y vivent, vérifiés présents. Le backoffice ne fait
  qu'appeler `functions.invoke` : il n'a jamais eu besoin de ces clés, elles ont été retirées de Terraform.
- **GitHub Actions** ← secrets du dépôt. `SUPABASE_ACCESS_TOKEN` pour le drift-check.

À savoir : `EMAIL_FROM` n'est pas dans les secrets Supabase, `send-email` retombe sur son fallback en dur.
