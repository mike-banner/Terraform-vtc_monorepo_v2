# Plan de Revue Sécurité — VTC HUB
> ⚠️ **Tests manquants** : aucun test unitaire ou d'intégration dans ce projet (`tsc` + `build` uniquement). Chaque épisode devra être vérifié manuellement. À terme : ajouter des tests pour les endpoints API critiques (submit-rating, approve-onboarding, create-booking).
> App : Astro SSR sur Cloudflare Pages · Supabase · Stripe Connect · QR Code rating public
> Méthode : épisodes indépendants, du plus critique au moins critique.

---

## ✅ Épisode 1 — Broken Access Control : Notation de Course (CRITIQUE) — *2026-05-20*

**Fichiers :** `src/pages/rate/[id].astro`, `src/pages/api/submit-rating.ts`

**Problème :**
- La page `/rate/[id]` et l'API `POST /api/submit-rating` n'ont **aucune vérification d'identité**.
- N'importe qui peut noter n'importe quelle course en connaissant (ou devinant) l'UUID.
- Pas de guard "déjà noté = bloqué" côté API (seulement côté affichage SSR).
- Le `bookingId` n'est pas re-vérifié contre le tenant dans l'API.

**Actions :**
- [x] Vérifier dans `submit-rating.ts` que la course existe ET que `rating IS NULL` avant d'écrire.
- [x] Limiter les valeurs de `rating` à `[1, 5]` entier côté serveur (pas seulement frontend).
- [x] Sanitiser `comment` (longueur max 500 chars, trim).
- [x] Vérifier que `mission_status === 'completed'` avant d'accepter la note.
- [x] Note : cross-tenant non applicable — UUID non-devinable, flow QR public par design.

---

## ✅ Épisode 2 — Privilege Escalation : Approbation Onboarding sans Auth (CRITIQUE) — *2026-05-20*

**Fichiers supprimés :** `src/pages/api/approve-test.ts`, `src/pages/admin-test.astro`

**Problème :**
- `approve-test.ts` appelait l'Edge Function d'approbation avec la SERVICE_ROLE_KEY sans aucune vérification d'identité.
- `admin-test.astro` exposait un UUID hardcodé et un bouton sans auth.

**Actions :**
- [x] `approve-test.ts` supprimé (reliquat de dev, non utilisé en prod).
- [x] `admin-test.astro` supprimé (page de test avec UUID hardcodé).
- [x] Endpoint officiel `src/pages/api/admin/approve.ts` audité — guard `isPlatform(profile)` correctement en place, retourne 403 sinon.

---

## Épisode 3 — Sécurisation des Liens Externes : Stripe & QR Codes

**Fichiers :** `supabase/functions/stripe_webhook/`, `src/pages/rate/[id].astro`, `src/scripts/bookings.ts`

**Problème Stripe :**
- La signature Stripe est correctement vérifiée via `constructEventAsync` ✅
- Mais les métadonnées du checkout (`pickup_address`, `tenant_id`, `customer_id`, `pricing`) sont stockées en DB **telles quelles sans revalidation**.
- Un attaquant qui contrôle les métadonnées Stripe (via un checkout manipulé) peut injecter des données arbitraires.

**Problème QR :**
- Les QR codes pointent vers `window.location.origin/rate/${bookingId}` — généré client-side.
- Sur Cloudflare, l'origine est correcte, mais si l'app est servie derrière un proxy custom, l'URL pourrait être incorrecte.

**Actions :**
- [ ] Dans le webhook Stripe : valider `tenant_id` existe en DB avant de créer la course.
- [ ] Valider `pricing` (montant) contre la grille tarifaire du tenant en DB (ne pas faire confiance au prix du checkout).
- [ ] Sanitiser `pickup_address` / `dropoff_address` depuis les métadonnées (longueur max, trim).
- [ ] Pour les QR codes : utiliser la variable d'environnement `PUBLIC_SITE_URL` plutôt que `window.location.origin`.
- [ ] S'assurer que les liens Google Reviews (`google_reviews_url`) sont validés comme URLs HTTPS avant stockage.

---

## Épisode 4 — Service Role Key : Usage et Exposition

**Fichiers :** `src/lib/supabase/server.ts`, `src/pages/api/tenant/create-booking.ts`, `src/pages/api/admin/approve-onboarding.ts`

**Problème :**
- Le `SUPABASE_SERVICE_ROLE_KEY` est utilisé dans plusieurs API routes — il bypasse le RLS.
- Si une route qui utilise l'admin client n'a pas de guard applicatif strict, les politiques RLS de Supabase sont contournées.

**Actions :**
- [ ] Inventorier tous les fichiers qui appellent `createAdminClient()` — lister chacun et vérifier que le guard est en amont.
- [ ] `create-booking.ts` : le montant `manual_total` est accepté sans validation (peut être 0, négatif, ou string). Ajouter validation `parseFloat > 0`.
- [ ] Remplacer l'admin client par le client authentifié utilisateur quand le RLS suffit.
- [ ] S'assurer que `SUPABASE_SERVICE_ROLE_KEY` n'est **jamais** dans le bundle client (Vite ne doit pas l'exposer via `import.meta.env.PUBLIC_*`).

---

## Épisode 5 — Suppression de Compte : Vérification RPC et CSRF

**Fichiers :** `src/pages/app/settings.astro`, `supabase/functions/delete-tenant-account/`

**Problème :**
- La suppression passe par `supabase.functions.invoke('delete-tenant-account')` côté client.
- La protection est uniquement la phrase de confirmation JS — contournable via appel direct à l'Edge Function.
- La RPC `delete_tenant_account()` doit impérativement vérifier que le JWT appartient bien au tenant qu'elle supprime.

**Actions :**
- [ ] Lire le code de `supabase/functions/delete-tenant-account/index.ts` et vérifier que le `user.id` est extrait du JWT (pas d'un paramètre de requête).
- [ ] Vérifier que la RPC SQL `delete_tenant_account` filtre par `auth.uid()` et non par un paramètre injectable.
- [ ] Ajouter un re-check `requireTenantRole(profile, ['owner'])` dans la fonction avant toute action.

---

## Épisode 6 — Headers de Sécurité & Configuration Cloudflare

**Fichiers :** `public/_headers` (ou `wrangler.toml`), `astro.config.mjs`

**Problème :**
- Cloudflare Pages ne configure pas automatiquement les headers de sécurité HTTP.
- Sans `Content-Security-Policy`, `X-Frame-Options`, `Referrer-Policy`, l'app est exposée à des attaques de clickjacking et de fuite de referrer vers Google Analytics / Stripe.

**Actions :**
- [ ] Créer/compléter `public/_headers` avec :
  - `Content-Security-Policy` : restreindre `script-src`, `connect-src` (Supabase URL + Stripe), `frame-ancestors 'none'`
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [ ] Vérifier que les liens Google Reviews utilisent `rel="noopener noreferrer"` ✅ (déjà fait)
- [ ] Confirmer que `STRIPE_WEBHOOK_SECRET` est en variable d'environnement Cloudflare (pas hardcodé).

---

## ✅ Épisode 7 — Middleware & Session : Surface d'Attaque Résiduelle — *2026-09-24*

**Fichier :** `src/middleware.ts`

**Problème :**
- Le middleware lit le profil à chaque requête via `getUser()` + query Supabase.
- Si une session JWT est compromise (vol de cookie), il n'y a pas de mécanisme de révocation immédiate côté serveur.
- Les redirections dans le middleware (`/signup?edit=true`) pourraient être exploitées pour des redirections ouvertes si le paramètre `edit` est utilisé pour construire une URL.

**Actions :**
- [x] `?edit=true` vérifié par lecture du code : uniquement une comparaison booléenne (`searchParams.get('edit') === 'true'`) pour choisir la cible — toutes les redirections du middleware sont des chemins hardcodés (`/waiting-approval`, `/signup`, `/app/dashboard`, `/`, `/login`). Aucun open redirect.
- [x] `getUser()` (remote, vérifie le JWT) est bien l'unique gate d'authentification (middleware L66). `getSession()` (L99) sert uniquement à décoder les claims de rôles **après** validation — même storage cookie dans la même requête, le token décodé est celui que `getUser()` vient de prouver.
- [x] Cookies : `Secure` **manquait en prod** — `@supabase/ssr` ne pose pas l'attribut par défaut (`DEFAULT_COOKIE_OPTIONS` : `sameSite: lax`, `httpOnly: false`, pas de `secure`) → forcé selon le protocole dans `setAll` + dans `defaultCookieOptions` du re-set `applySessionMaxAge`.
  - `HttpOnly` : **non applicable** — le browser client (`createBrowserClient`) lit les cookies via `document.cookie` ; l'activer casserait tout client auth côté navigateur (signOut, getUser de settings). Mitigation : CSP dans `public/_headers` (Épisode 6).
  - `SameSite=Lax` conservé (défaut Supabase) : `Strict` casserait les accès par liens externes (emails facture → `/app/...`). `Lax` bloque déjà tout envoi de cookie en POST cross-site (CSRF).
- [x] Déconnexion : les 8 call sites appellent `await supabase.auth.signOut()` — scope `global` par défaut → révocation **serveur** de tous les refresh tokens (GoTrue `POST /logout?scope=global`), pas juste un clear local. Résidu connu : l'access token volé reste valide jusqu'à expiration (défaut 1h) — inherent aux JWT, noté.

---

## Récapitulatif Priorités

| # | Épisode | Sévérité | Effort |
|---|---------|----------|--------|
| 1 | Notation sans auth | 🔴 Critique | Faible |
| 2 | Approve onboarding sans guard | 🔴 Critique | Faible |
| 3 | Stripe metadata + QR URL | 🟠 Haute | Moyen |
| 4 | Service Role Key scope | 🟠 Haute | Moyen |
| 5 | Suppression compte RPC | 🟡 Moyenne | Faible |
| 6 | Headers Cloudflare | 🟡 Moyenne | Faible |
| 7 | Middleware session | 🟡 Moyenne | Faible |

---

## ✅ Épisode 8 — Durcissement plateforme (audit complet) — *2026-09-22*

**Migrations :** `supabase/migrations/20260921000000_security_hardening.sql`, `supabase/migrations/20260922000000_tenant_status_kill_switch.sql`

**Problèmes corrigés :**
1. 🔴 **Escalade de privilèges** — `profiles_update_own` (`USING (id = auth.uid())`, sans `WITH CHECK`) permettait à tout utilisateur connecté de s'attribuer `platform_role = 'super_admin'` ou un autre `tenant_id` via PostgREST.
   → Trigger `prevent_profile_privilege_escalation` (bloque `platform_role` / `tenant_role` / `tenant_id` pour les rôles `anon`/`authenticated`) + policy resserrée.
2. 🔴 **Aspiration de la base clients** — policies `to anon using (true)` sur `bookings`, `customers`, `stripe_events`, jamais droppées. La clé publishable étant publique, `GET /rest/v1/customers?select=*` exposait tous les clients de tous les tenants.
   → Policies supprimées, remplacées par la RPC `get_public_booking_result(session_id)` (SECURITY DEFINER, colonnes limitées, clé = session Stripe non devinable).
3. 🔴 **Fuite d'informations tenant** — `public_read_tenants USING (true)` exposait `stripe_account_id`, `siret`, `vat_number`, adresses…
   → Remplacée par `get_public_tenant(host | id)` (`id, name, logo_url, primary_domain, phone, email`).
4. 🔴 **Backdoor superadmin** — allowlist d'emails en dur (`super@admin.com`, `mike.webfree@gmail.com`) dans `apps/superadmin/src/layouts/AdminLayout.tsx`.
   → Supprimée ; seule source d'autorité : `profiles.platform_role`.
5. 🔴 **Secrets versionnés** — `apps/vtc-backoffice/.dev.vars` (clé `sb_secret_*`, bypass RLS total) était tracké dans un repo **public**, ainsi que `scratch-tenant.ts` et `schema.json` (dump PostgREST complet).
   → Untrackés/supprimés, `.dev.vars` ajouté au `.gitignore` (+ `_headers` et garde-fou CI).
   ⚠️ La clé doit être **rotée** dans le dashboard Supabase (elle reste lisible dans l'historique git).
6. 🟠 **Kill Switch inopérant** — le superadmin écrivait `tenants.status`, colonne inexistante, sans policy UPDATE.
   → Colonne `status` + contrainte + policy `tenants_platform_admin_write` (super_admin), et **application réelle** de la suspension dans `apps/vtc-backoffice/src/middleware.ts`.
7. 🟠 **Webhook Stripe en 401** — `verify_jwt = true` sur `stripe_webhook` alors que Stripe n'envoie pas de JWT (`supabase/config.toml`).
   → `verify_jwt = false` + suppression du bloc mort `[functions.handle_stripe_webhook]`.
8. 🟠 **Cookies de session loggés** dans le middleware backoffice, `console.log` du logo.
   → Retirés.
9. 🟠 **Aucun header de sécurité sur le site vitrine** → `apps/vtc-websites/public/_headers`.
10. 🟠 **Écriture silencieusement perdue** — le logo (`settings.astro`) était enregistré par un UPDATE direct depuis le navigateur sans policy.
    → Route serveur `POST /api/tenant/update-logo` (admin client, scopé au tenant, URL restreinte au bucket public).
11. 🟡 **CI sans garde-fou** → job `verify` (secrets versionnés + typecheck) requis avant déploiement.

**Restes à traiter :**
- [x] **Roter la clé `sb_secret_*`** (2026-09-24) : rotation effectuée et **vérifiée par requête** — ancienne clé → HTTP 401 (révoquée), nouvelle → HTTP 200. Valeur propagée dans les 4 fichiers locaux (`.env` racine, `apps/vtc-backoffice/.env`, `.dev.vars`, `apps/superadmin/.env`). La copie restant dans l'historique git est morte : purge d'histoire non nécessaire.
- [ ] Cloudflare Pages : mettre à jour `SUPABASE_SERVICE_ROLE_KEY` dans Environment variables (`vtc-backoffice-*`, `vtc-superadmin-*`) puis redeploy — à confirmer.
- [x] Restaurer le typecheck de `apps/vtc-backoffice` (16 erreurs pré-existantes corrigées) puis l'ajouter au job `verify` (deploy.yml + script `pnpm --filter @vtc/vtc-backoffice typecheck`).
- [x] Corriger l'import cassé `./database.types` dans `src/lib/supabase/client.ts` → `import type { Database } from "@vtc/database"`.
- [ ] Ajouter des tests (aucun test unitaire/intégration : `tsc` + `build` uniquement).
- [ ] `pricing_rules` reste en lecture publique (by design) ; CSP avec `'unsafe-inline'` requis par les scripts `is:inline` d'Astro.
