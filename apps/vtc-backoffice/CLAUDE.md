# Règles — backoffice

Dashboard SaaS tenant (chauffeurs/agences VTC) : bookings, fiscalité, tarifs, véhicules, onboarding. Astro SSR + React (îlots interactifs uniquement, `client:load`). Décisions d'architecture : `docs/decisions/ADR-001-monorepo-split-supabase-root.md` (monorepo-wide) et `docs/decisions/backoffice/ADR-*.md`.

## Fichiers cœur (à lire avant d'y toucher)

| Fichier | Rôle |
|---|---|
| `src/middleware.ts` | Guard global : auth, résolution du rôle (`platform_role`/`tenant_role`/`tenant_id`), routage SaaS |
| `src/lib/supabase/server.ts` | Client admin (`createAdminClient`, bypass RLS) — à manier avec précaution |
| `src/pages/api/missions/terrain-transition.ts` | Seule route autorisée à changer `mission_status` |
| `src/lib/pricing.ts` | `computeVat()` — calcul TVA centralisé (TTC → HT) |
| `supabase/functions/stripe_webhook/` | Paiement/remboursement, recalcul serveur du montant |

## Interdits

- Calcul de montants (`total_amount`, `minimum_fare`, TVA) côté client JS — toujours via API route ou RPC serveur.
- `createAdminClient` en dehors d'une route API serveur.
- UPDATE/DELETE sur `financial_movements` (ledger immuable, audit trail). INSERT réservé au `service_role`.
- Changer `mission_status` ailleurs que via `/api/missions/terrain-transition`.
- INSERT sur `drivers` par un rôle autre que `tenant_role = 'owner'` (policy `drivers_insert_owner_only`).
- Élément UI à largeur fixe (`w-[1200px]`) sans variante mobile — le produit est mobile-first absolu (tester à 375px, pas de `lg:` pour la structure par défaut).

## Conventions

- DB : tables/colonnes `snake_case`, triggers `trg_[action]`.
- Composants React : `PascalCase`. Routes API : `kebab-case`/`snake_case` sous `/api/`.
- Après tout changement de schéma : `pnpm --filter @vtc/backoffice gen:types`.

## Rôles & accès (`profiles`)

- `platform_role` (super_admin/platform_staff) → `/admin/*` uniquement, jamais `/app/*`.
- `tenant_role` pending → `/onboarding` jusqu'à validation via `approve_onboarding_tx()`.
- `tenant_role = owner` + `tenant_id` → `/app/*`. `manager`/`driver` (sous-rôles tenant) : prévus, pas encore implémentés.
- Toute table métier filtrée par `current_tenant_id()` ; jamais de donnée cross-tenant via anon key.

## Facturation (voir `docs/BILLING.md`)

- Devis (`DEV-`) = aucune valeur fiscale, annulable librement. Facture (`FAC-`) émise = non annulable, toute correction passe par un avoir Stripe (`creditNotes`).
- Numérotation facture actuelle (`FAC-YYYYMMDD-{id_court}`) non conforme art. L441-3 — ne pas reproduire ce format ailleurs ; corriger via compteur séquentiel par tenant/année si on retouche `generate-invoice`.
- Annulation après paiement : jamais de suppression de facture Stripe — avoir + mouvement `refund` (`debit`) dans `financial_movements`.
- E-invoicing (Factur-X) obligatoire pour TPE/micro-entrepreneurs à partir de 09/2027 — Stripe seul n'est pas une PDP agréée.
- Prix grille = TTC, jamais HT+TVA ajoutée par-dessus. Forme juridique pilote `is_vat_exempt`/`vat_rate` via triggers (`trg_set_tenant_vat_on_insert`, `trg_sync_tenant_vat`).

## Incidents fréquents

- Webhook Stripe 401 → vérifier `STRIPE_WEBHOOK_SECRET` dans les secrets Supabase.
- Règles métier (ex: un seul véhicule actif) silencieuses en local → `ALTER TABLE ... ENABLE TRIGGER ALL` (triggers parfois désactivés en dev).
