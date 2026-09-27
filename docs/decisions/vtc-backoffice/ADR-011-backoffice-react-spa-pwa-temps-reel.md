# ADR-011 : Backoffice en SPA React, PWA à rafraîchissement temps réel

## Statut
Proposé (2026-09-27). À passer en « Accepté » au lancement de la Phase 13.

## Contexte
- Le backoffice est une app Astro en rendu serveur (`output: "server"`, adapter Cloudflare) qui mélange trois
  modèles d'interface : pages `.astro`, îlots React (11 composants), et scripts DOM impératifs (16 blocs, dont
  `scripts/bookings.ts`, 1 100 lignes). Chaque navigation recharge la page.
- Les courses sont **asynchrones** : une réservation arrive du site public après paiement Stripe
  (`stripe_webhook`), le client peut annuler (`cancel-booking`), un remboursement peut échouer, un autre
  chauffeur peut changer le statut. Aujourd'hui l'écran ne se met à jour qu'au rechargement : aucun canal
  Realtime n'est ouvert et la publication `supabase_realtime` ne contient aucune table (ADR-002 se dit
  « implémenté », ce n'est pas le cas).
- Le contrôle des rôles tenant (owner / manager / driver) n'existe que dans le middleware Astro
  (`ROUTE_POLICY`). La RLS ne les distingue pas : un driver peut écrire tarifs, véhicules et chauffeurs en
  appelant PostgREST directement (diagnostic du 2026-09-27, voir ROADMAP Phase 13).
- Le chauffeur utilise le backoffice sur son téléphone, en course : il faut une application installable,
  qui reste à jour sans action de sa part.

## Décision
1. **Cible : SPA React (Vite + React Router)**, sur le modèle d'`apps/superadmin`. Astro reste l'outil de
   `vtc-websites` (contenu, SEO), pas du backoffice.
2. **La sécurité descend en base avant toute bascule.** Rôles tenant dans la RLS ; les écritures sensibles
   passent par des RPC `SECURITY DEFINER` à contrôle de rôle ou des Edge Functions. Aucune règle d'accès ne
   repose sur le code client. La clé `service_role` ne quitte jamais le serveur.
3. **Migration par étapes livrables, sans big bang** : pages converties en composants React *dans* Astro
   d'abord (îlots `client:only`), bascule de l'enveloppe en SPA en dernier. Les composants sont réutilisés tels
   quels.
4. **Temps réel en lecture seule, écritures par le serveur** (principe d'ADR-002 conservé) :
   - Supabase Realtime en **Broadcast depuis la base** (`realtime.broadcast_changes` déclenché par trigger)
     sur un canal **privé par tenant**, autorisé par RLS sur `realtime.messages`.
   - Le message ne transporte que `{id, status, mission_status, updated_at}` ; le client **relit** la course
     par une requête soumise à la RLS. Aucune donnée ne fuit par le canal.
   - État client via TanStack Query : un événement invalide ou patche le cache ; `updated_at` départage les
     événements hors d'ordre.
5. **« Rafraîchissement constant » = trois mécanismes complémentaires**, parce qu'un WebSocket meurt en
   silence quand un téléphone met l'app en arrière-plan :
   - app au premier plan : canal Realtime ;
   - retour au premier plan, reconnexion réseau, réabonnement du canal : resynchronisation complète
     (`visibilitychange`, `online`, statut `SUBSCRIBED`) + filet de sécurité par sondage (60 s, premier plan
     uniquement) ;
   - app en arrière-plan ou fermée : **Web Push** (VAPID) déclenché côté serveur sur les événements qui
     exigent une action (nouvelle course, annulation, échec de paiement ou de remboursement). Sur iOS, le push
     n'est disponible que pour une PWA installée (iOS ≥ 16.4) et après consentement.
6. **Hors ligne : lecture seule.** Les courses du jour restent consultables ; toute écriture est désactivée
   hors ligne. Pas de file d'attente d'écritures en v1 : une transition de statut ou un encaissement rejoué
   plus tard pourrait contredire ce qui s'est passé entre-temps, et le grand livre est immuable.
7. **Mise à jour de l'app** : service worker en mode `prompt` — une nouvelle version déployée est proposée au
   chauffeur, jamais appliquée au milieu d'une action.

## Conséquences
- + Un seul modèle d'interface pour backoffice et superadmin ; navigation instantanée ; PWA hors ligne naturelle.
- + Les règles d'accès valent pour tous les clients (backoffice, superadmin, PWA, future app mobile).
- + Déploiement statique : plus de rendu serveur à héberger pour le backoffice.
- − Jeton de session stocké côté navigateur (au lieu d'un cookie `httpOnly`) : CSP stricte obligatoire.
- − 6 à 8 semaines de travail sans fonctionnalité métier nouvelle, hors valeur apportée par le temps réel.
- − Web Push ajoute une table d'abonnements, des clés VAPID (secret Supabase) et un parcours d'installation
  sur iOS.

## Alternatives écartées
- **Garder Astro et ajouter des îlots** : ne règle ni la navigation par rechargement, ni le mode hors ligne ;
  c'est seulement l'étape intermédiaire retenue au point 3.
- **Framework React à serveur (React Router framework, Next.js)** : réécriture complète sans le bénéfice
  principal (déploiement statique, sécurité portée par la base).
- **`postgres_changes` au lieu de Broadcast** : plus simple, mais chaque changement est vérifié par la RLS
  pour chaque abonné et le message porte la ligne entière ; Supabase recommande Broadcast pour les canaux
  privés à l'échelle.
- **Sondage seul** : simple, mais latence et consommation de batterie ; conservé uniquement comme filet de
  sécurité.
