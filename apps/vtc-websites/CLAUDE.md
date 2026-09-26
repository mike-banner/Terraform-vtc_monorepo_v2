# Règles — vtc-websites (drivers-front)

Site vitrine public multi-tenant (un domaine par chauffeur/agence) + tunnel de réservation. **Vitrine passive : aucune logique critique ou financière ne vit ici**, tout est délégué au backoffice. Décision d'architecture : `docs/decisions/vtc-websites/0002-resolution-domaine-multi-tenant.md`.

> Conventions transverses (commits sans marque IA, gestion des secrets) : `AGENTS.md` à la racine.

## Résolution du tenant

- `resolveTenant(host)` mappe le `Host` HTTP → RPC `get_public_tenant` → champs publics du tenant (middleware, requête Supabase unique par requête SSR).
- Dev local : variable `PUBLIC_SITE` pour forcer le site testé. Preview Cloudflare : alias ou sous-domaine `*.pages.dev`.
- Toute requête de lecture doit filtrer par le `tenant_id` résolu — pas d'exception.

## Accès Supabase

| Table | Accès front | Canal |
|---|---|---|
| `tenants` | Champs publics uniquement (`id`, `name`, `logo_url`, `primary_domain`, `phone`, `email`) | RPC `get_public_tenant` — **pas de lecture directe** |
| `vehicles`, `pricing_rules` | Lecture publique | SDK direct |
| `bookings` | Aucune lecture directe. Résultat d'une réservation payée : RPC `get_public_booking_result(session_id)` | RPC / Edge Function backoffice |
| `customers`, `stripe_events` | Interdit total | — |

## Interdits

- Aucune écriture/UPDATE directe sur `bookings`, `pricing_rules` depuis le client.
- Aucun calcul financier côté client — le montant final envoyé à Stripe est calculé par l'Edge Function backoffice à partir des règles en base.
- Le front ne change jamais le statut d'un booking (réservé aux webhooks Stripe / actions admin).

## Formulaires

- Validation typée Zod systématique. Téléphones en E.164.
- Date picker : dates passées bloquées + délai de prévenance minimal (ex: pas de réservation à moins de 2h).

## Tunnels de réservation

- Types prévus : transfert A→B, mise à disposition (forfait horaire), longue distance, business/event (devis libre).
- Tunnels implémentés : ceux présents dans `src/components/booking/`.

## SEO (invariants)

- Un seul `<h1>` par page. `<title>` ≤ 60 car., `<meta description>` ≤ 155 car., `<link rel="canonical">` toujours en URL absolue.
- JSON-LD `LocalBusiness`/`TaxiService` sur chaque page vitrine (avis, `areaServed`, contact).
- Lighthouse > 90 mobile et desktop.
