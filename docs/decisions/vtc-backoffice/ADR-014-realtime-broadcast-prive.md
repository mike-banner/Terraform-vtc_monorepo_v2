# ADR-014 : Temps réel par diffusion privée depuis la base

## Statut
Accepté (2026-10-03). Remplace ADR-002.

## Contexte
- ADR-002 se disait implémenté alors qu'aucun canal n'existait.
- ADR-011 §4-5 fixe la cible : Broadcast depuis la base, canal privé par tenant, TanStack Query.
- Le backoffice deviendra une PWA avec notifications push (phases 17, 18).

## Décision
- Colonne `bookings.updated_at` (trigger avec `clock_timestamp()`, pas `moddatetime`).
- Trigger `AFTER INSERT/UPDATE` SECURITY DEFINER `broadcast_booking_change` → `realtime.send` (pas `broadcast_changes`, qui envoie la ligne entière).
- Un topic par tenant pour tous ses membres owner/manager/driver (le driver lit déjà toutes les courses du tenant, matrice phase 13).
- Policy SELECT `realtime_tenant_bookings_receive` ; aucune policy d'écriture.
- Côté client, package `@vtc/realtime` : invalidation du cache, pas de patch.

## Contrat d'événements
Source unique, réutilisée par la phase 18.

- Événement `booking_changed`, topic `tenant:<current_tenant_id>:bookings`, canal privé, payload exactement
  `{ id, status, mission_status, driver_id, updated_at }`. Aucune autre clé ne sera ajoutée sans nouvel ADR.
- Émis à tout INSERT et à tout UPDATE réel (`OLD.* IS DISTINCT FROM NEW.*`) ; un UPDATE sans changement n'émet rien.
- Classification dérivée de OLD/NEW (documentée ici, aucun code en phase 15) :

| Genre | Condition | Chemin d'écriture |
|---|---|---|
| `new_paid` | INSERT avec `status = 'paid'` | `stripe_webhook` (service_role) |
| `cancelled` | `status` passe à `cancelled_no_refund` / `cancelled_pending_refund` / `cancelled_refunded` | `cancel_booking` (Edge Function `cancel-booking`), `record_booking_refund` |
| `refund_failed` | `status` passe à `refund_failed` | `mark_refund_failed` (stripe_webhook) |
| `accepted` | `status` passe à `accepted` | `accept_paid_booking` |
| `assigned` | `driver_id` change | UPDATE de colonne par owner/manager |
| `mission_step` | `mission_status` change | `terrain_transition` |
| `updated` | tout autre changement | RPC d'édition |

- Le statut `expired_payment`, s'il est un jour écrit, est diffusé comme tout changement de `status` ; l'alerte de session Stripe expirée est hors périmètre.
- Branchement de la phase 18 (non construit ici) : un second trigger (ou webhook de base) sur `bookings` appelle une Edge Function
  `send-push` avec `id` et le genre calculé par une fonction SQL `booking_change_kind(old, new)` écrite à ce moment-là, à partir du tableau
  ci-dessus. Elle sera son seul consommateur ; le payload Realtime reste à 5 clés. La table `push_subscriptions` et les clés VAPID
  relèvent de la phase 18 (hors périmètre ici). Pas de fonction de classification en phase 15 : elle n'aurait aucun consommateur.

## Cohérence premier plan / arrière-plan
À la réouverture (retour au premier plan, `online`, clic sur une notification de la phase 18), le client relit tout
(`SUBSCRIBED` → invalidation, `refetchOnWindowFocus`, `refetchOnReconnect`). Un événement dont `updated_at` est inférieur ou égal à
celui du cache est ignoré (comparaison à la microseconde) : pas de double rafraîchissement ni d'état régressé. L'état affiché vient
toujours d'une relecture sous RLS, jamais du payload. Sondage de secours à 60 s au premier plan seulement.

## État de connexion
- Trois états : `online | reconnecting | offline`, exposés par `useConnectionState()` et `useTenantBookingsRealtime(client, tenantId)`.
- La phase 16 désactive les écritures hors `online`. Alias `useSyncStatus()`.
- Clés de cache uniques `['bookings']`, `['bookings', 'list', {…}]`, `['bookings', 'detail', id]` (`BOOKINGS_KEYS`).
- Cœur pur sans DOM ; écouteurs injectables via `onlineManager.setEventListener` / `focusManager.setEventListener` (service worker, phase 17).

## Sécurité
- Isolement par topic ; payload sans donnée personnelle ni montant ; aucune émission côté client (lint règle 11).
- Fonction DEFINER sans EXECUTE pour PUBLIC/anon/authenticated.
- Autorisation évaluée à la jointure et à chaque nouveau jeton : un retrait de rôle agit au prochain jeton ; les données restent sous RLS.
- Réglage projet « Allow public access » désactivé en production (action humaine au déploiement).
- Une course transférée entre tenants n'est diffusée qu'au tenant courant : ajouter un `send` vers `original_tenant_id` si le partage réseau arrive.

## Couverture et limites
- Une seule source diffusée, `bookings`. Les demandes et devis (Mise à disposition, Longue distance) y vivent : couverts.
- `ledger` et `dashboard` ne sont pas diffusés ; ils sont invalidés côté cache à chaque événement `booking_changed` (`DERIVED_KEYS`, effectif quand la phase 16 les convertit).
- Seul le backoffice est temps réel ; le superadmin ne reçoit que le `QueryClient` et l'état, sans pastille tant qu'il n'écoute aucun canal (topic plateforme reporté).
- Membres, rôles, suspension de tenant (`tenants.status`) : non diffusés. La suspension n'est appliquée qu'au chargement de page (middleware) et un membre retiré garde le canal jusqu'au prochain jeton ; les données restent sous RLS. À traiter avec la coque de la phase 16 (suspension).

## Suppression
Les courses ne sont jamais supprimées (`trg_prevent_booking_delete`, test dans `rpc_realtime_checks.sql`). Le contrat ne définit donc aucun
événement de suppression. Le jour où ce garde-fou saute, le test échoue et impose un trigger DELETE (`booking_changed` avec
`status` = `deleted`, ou ADR de remplacement).

## Interrupteur par instance
Le canal est fermé par défaut ; `PUBLIC_REALTIME_ENABLED=true` (variable de compilation du backoffice) l'ouvre. Fermé : aucune connexion
WebSocket, rafraîchissement par sondage de 60 s et au retour au premier plan. Motif : volume faible (2 à 3 courses par jour et par client),
projet parfois mutualisé entre tenants, quotas de connexions ; le Web Push (phase 18) couvre le cas urgent (annulation de dernière minute).
Le trigger et la policy restent déployés dans tous les cas.

## Quotas et dimensionnement
- Plafonds Supabase Realtime (à revérifier sur supabase.com/docs/guides/realtime/limits à l'écriture) :
  Free : 200 connexions, 100 msg/s, payload 256 ko ; Pro : 500 connexions, 500 msg/s, payload 3 Mo.
- Une connexion par onglet ou PWA ouvert ; un message par changement de course, diffusé à chaque membre connecté du tenant (diffusion = N messages reçus).
- Formule : connexions ≈ membres connectés simultanément ; msg/s reçus ≈ changements/s × membres connectés. Une instance par client : très en dessous des plafonds.
- Seuil d'alerte à noter dans `docs/` pour le 1er client : 80 % de la connexion ou du débit du plan, lu au tableau Realtime du projet.
- Le sondage de secours (60 s) et la resynchronisation sur `SUBSCRIBED` passent par PostgREST, pas par Realtime : ils ne consomment pas ce quota.

## Vérification
- `supabase/lint/rpc_realtime_checks.sql` (CI db-lint), `security_checks.sql` règles 7 et 11.
- `node --test packages/realtime/src/*.test.mjs`.
- Commande documentée `node scripts/realtime-smoke.mjs` (pile locale, hors CI) : livraison, refus inter-tenant, reconnexion.

## Conséquences
- + Aucune donnée métier ne transite par le canal : l'état vient toujours d'une relecture sous RLS.
- + Un seul contrat d'événements pour les phases 16 à 18.
- + Canal fermé par défaut : aucun coût de connexion tant qu'une instance ne l'active pas.
- - Un refetch par événement.
- - Le superadmin n'écoute aucun canal ; topic plateforme reporté.
