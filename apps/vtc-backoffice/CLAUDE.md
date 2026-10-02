# Règles — backoffice

Dashboard SaaS tenant (chauffeurs/agences VTC) : bookings, fiscalité, tarifs, véhicules, onboarding. Astro SSR + React (îlots interactifs uniquement, `client:load`). Décisions d'architecture : `docs/decisions/ADR-001-monorepo-split-supabase-root.md` (monorepo-wide) et `docs/decisions/vtc-backoffice/ADR-*.md`.

> Conventions transverses (commits sans marque IA, gestion des secrets) : `AGENTS.md` à la racine.

## Fichiers cœur (à lire avant d'y toucher)

| Fichier | Rôle |
|---|---|
| `src/middleware.ts` | Guard global : auth, résolution du rôle (`platform_role`/`tenant_role`/`tenant_id`), routage SaaS |
| `supabase/migrations/20260929110400_rpc_terrain_transition.sql`, `20261002100200_booking_cancel_refund.sql` | Seuls chemins qui changent `mission_status` / annulent une course (RPC gardées par rôle) : `terrain_transition` / `cancel_booking` (via l'Edge Function `cancel-booking`) / `mark_booking_no_show`. Le pourcentage de remboursement vient de `cancellation_preview` ; la politique se règle par `update_cancellation_policy` (owner). `api/missions/terrain-transition` et `api/tenant/booking-actions` n'en sont que les proxys |
| `supabase/migrations/20260929110300_booking_pricing_functions.sql` | `calculate_booking_price` / `booking_vat_split` : prix et TVA de toute écriture. `src/lib/pricing.ts` = aperçu client seulement, non contractuel |
| `supabase/functions/stripe_webhook/` | Paiement/remboursement, recalcul serveur du montant |

## Interdits

- Calcul de montants (`total_amount`, `minimum_fare`, TVA) côté client JS — toujours via API route ou RPC serveur.
- Client admin / clé `service_role` dans le backoffice (supprimés en Phase 14, bloqué par la CI). Toute écriture sensible = RPC `SECURITY DEFINER` gardée par `current_tenant_role()`.
- UPDATE/DELETE sur `financial_movements` (ledger immuable, audit trail). INSERT réservé au `service_role` et aux RPC de confiance (ADR-012) ; jamais d'ouverture au client des colonnes statut/montants de `bookings` sans relire ADR-012.
- Changer `mission_status` ou annuler une course ailleurs que via les RPC `terrain_transition` / `cancel_booking` (via l'Edge Function `cancel-booking`) / `mark_booking_no_show`. Aucun pourcentage ni montant de remboursement calculé côté navigateur.
- INSERT sur `drivers` par un rôle autre que `owner`/`manager` (policy `drivers_insert`, Phase 13). Un
  `driver` ne peut modifier que son propre `phone` sur sa fiche (trigger `drivers_self_update_guard`).
- Élément UI à largeur fixe (`w-[1200px]`) sans variante mobile — le produit est mobile-first absolu (tester à 375px, pas de `lg:` pour la structure par défaut).

## Conventions

- DB : tables/colonnes `snake_case`, triggers `trg_[action]`.
- Composants React : `PascalCase`. Routes API : `kebab-case`/`snake_case` sous `/api/`.
- Après tout changement de schéma : `pnpm --filter @vtc/vtc-backoffice gen:types`.

## Rôles & accès (`profiles`)

- `platform_role` (super_admin/platform_staff) → aucune page du backoffice (accueil seul, ADR-009) ; l'administration plateforme vit dans `apps/superadmin`.
- `tenant_role` pending → `/onboarding` jusqu'à validation via `approve_onboarding_tx()`.
- `tenant_role = owner` + `tenant_id` → `/app/*`. `driver` : reconnu par le middleware (session prolongée pendant une course). `manager` : pas encore implémenté.
- Toute table métier filtrée par `current_tenant_id()` ; jamais de donnée cross-tenant via anon key.

## Facturation (voir `docs/BILLING.md`)

- Devis (`DEV-`) = aucune valeur fiscale, annulable librement. Facture (`FAC-`) émise = non annulable, toute correction passe par un avoir Stripe (`creditNotes`).
- Numérotation facture : compteur séquentiel par tenant/année via RPC `next_invoice_number` (`FAC-YYYY-0001`, art. L441-3) — ne jamais générer de numéro `FAC-` autrement.
- Annulation après paiement : jamais de suppression de facture Stripe — avoir + mouvement `refund` (`debit`) dans `financial_movements`.
- E-invoicing (Factur-X) obligatoire pour TPE/micro-entrepreneurs à partir de 09/2027 — Stripe seul n'est pas une PDP agréée.
- Prix grille = TTC, jamais HT+TVA ajoutée par-dessus. Forme juridique pilote `is_vat_exempt`/`vat_rate` via le trigger unique `trg_sync_tenant_vat` (INSERT et UPDATE OF legal_form).

## Incidents fréquents

- Webhook Stripe 401 → vérifier `STRIPE_WEBHOOK_SECRET` dans les secrets Supabase.
- Règles métier (ex: un seul véhicule actif) silencieuses en local → `ALTER TABLE ... ENABLE TRIGGER ALL` (triggers parfois désactivés en dev).
