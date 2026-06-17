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

## Épisode 7 — Middleware & Session : Surface d'Attaque Résiduelle

**Fichier :** `src/middleware.ts`

**Problème :**
- Le middleware lit le profil à chaque requête via `getUser()` + query Supabase.
- Si une session JWT est compromise (vol de cookie), il n'y a pas de mécanisme de révocation immédiate côté serveur.
- Les redirections dans le middleware (`/signup?edit=true`) pourraient être exploitées pour des redirections ouvertes si le paramètre `edit` est utilisé pour construire une URL.

**Actions :**
- [ ] Confirmer que le paramètre `?edit=true` ne construit pas une URL de redirect dynamique (vérification lecture du code).
- [ ] S'assurer que `getUser()` est utilisé (vérifie le JWT en remote) et non `getSession()` (local uniquement, plus falsifiable).
- [ ] Vérifier que le cookie de session est configuré `HttpOnly; Secure; SameSite=Strict` dans les options Supabase Auth.
- [ ] S'assurer que la déconnexion révoque le JWT côté Supabase (pas juste un clear de cookie local).

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
