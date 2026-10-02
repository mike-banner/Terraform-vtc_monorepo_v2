# Backlog — pistes reportées à une future V*

Points volontairement laissés de côté, pas oubliés. Chacun a une raison de ne pas être fait maintenant ;
à rouvrir quand cette raison change.

## Multi-chauffeurs / rôle `manager`

**Reporté depuis :** Phase 9 (2026-09-24), démarrage en chauffeur solo.
**État actuel :** le rôle `manager` existe dans `ROUTE_POLICY` et sera couvert par la matrice rôle × table
de la Phase 13, mais rien ne l'exploite : aucun flux d'invitation, aucune UI d'assignation entre plusieurs
chauffeurs.

Ce qu'il faudrait construire pour aller plus loin, si un tenant a plusieurs chauffeurs :
- **Invitation / rattachement d'un chauffeur au tenant** : aujourd'hui un `driver` est créé par l'owner
  directement (pas de flux d'invitation par e-mail avec acceptation).
- **Assignation de courses entre plusieurs chauffeurs** : `bookings.driver_id` existe déjà, mais aucune UI
  ne permet à un owner/manager de réassigner une course en attente à un chauffeur précis parmi plusieurs
  (aujourd'hui : un seul chauffeur actif par tenant en pratique).
- **Visibilité du planning multi-chauffeurs** : pas d'écran d'occupation/disponibilité par chauffeur.
- **Droits du rôle `manager`** : à définir précisément dans la matrice de la Phase 13 (ex. le manager
  peut-il modifier les tarifs ? inviter un chauffeur ? voir la compta ?) — actuellement `manager` est un
  statut inerte, ses droits ne sont pas distincts de `driver` en pratique.
- **Notifications** : si plusieurs chauffeurs, il faut distinguer qui reçoit l'alerte nouvelle course
  (aujourd'hui : diffusion simple, pensée pour un chauffeur unique).

**Déclencheur pour rouvrir :** le premier tenant qui déclare plus d'un chauffeur actif.

## Assujettissement TVA dérivé de `legal_form`

**Reporté depuis :** Phase 11 (2026-09-26), décision utilisateur.
**État actuel :** la synchro TVA a été fusionnée (une seule fonction), mais l'assujettissement à la TVA
est today déduit uniquement de `legal_form`, sans tenir compte du régime réel de l'auto-entrepreneur
(franchise en base vs option pour la TVA).

**Déclencheur pour rouvrir :** le premier auto-entrepreneur assujetti à la TVA sur la plateforme.

## Rectification du numéro de carte VTC (license_number) par un admin

**Reporté depuis :** Phase 13 (2026-09-29), décision utilisateur — le driver ne peut pas modifier son propre
`license_number` (traité comme donnée d'identité, réservé owner/manager par la RLS).
**Idée à creuser plus tard :** un flux admin (superadmin ou owner) pour corriger/vérifier le numéro de carte
VTC d'un chauffeur, éventuellement recoupé avec une API officielle de vérification des cartes VTC si une
existe. Pas de solution ni d'API identifiée pour l'instant — à rechercher le moment venu.

**Déclencheur pour rouvrir :** une erreur de saisie constatée sur un `license_number` en prod, ou un besoin
de vérification réglementaire.

## Formule de prix dupliquée dans les Edge Functions

**Reporté depuis :** Phase 14 (2026-09-29), D-03 : la formule des écritures du backoffice vit dans
`public.calculate_booking_price` / `public.booking_vat_split` (migration `20260929110300`).
**État actuel :** deux autres copies TypeScript : `create_checkout_session/index.ts` (prix + `fixed_routes`, sans
TVA, `safeTotal` minimum 1) et `stripe_webhook/index.ts` (recalcul + TVA). `lib/pricing.ts` reste pour l'aperçu
client de `scripts/bookings.ts`, non contractuel. Hors périmètre de la Phase 14 : ces fonctions tournent
légitimement en `service_role` (paiement).
**Vecteur commun** (mêmes entrées, même sortie attendue dans les trois implémentations) : règle base 10, km 2,
heure 50, minimum 20 ; transfert 30 km = 70 ; transfert 2 km = 20 ; hourly 2 h = 110 ; TVA 10 % sur 100 = 90.91 +
9.09 ; TVA 20 % sur 33.33 = 27.78 + 5.55 (DECISION-ARRONDI V1).

**Déclencheur pour rouvrir :** toute modification de la formule, ou la migration des Edge Functions de paiement
vers la RPC (appel `calculate_booking_price` avec la clé service_role).

## Modals génériques du backoffice (remplacer alert, confirm, prompt du navigateur)

**Reporté depuis :** Phase 14.1 (2026-10-02), décision utilisateur après test du parcours d'annulation : les fenêtres
`alert`, `confirm` et `prompt` du navigateur ne sont pas celles de l'application.
**État actuel :** environ 23 appels, dans `scripts/bookings.ts` (13), `pricing.astro` (3), `settings.astro` (4),
`setup.astro` (2) et `profile.astro` (1).
**À faire :** un modal générique centré (titre, message, champs variables, boutons) avec une API d'appel
unique, utilisé partout. Version bureau en React lors de la Phase 16 (pages en React). Version mobile avec la
Phase 18 (notifications), pas avant.

**Déclencheur pour rouvrir :** démarrage de la Phase 16, ou un retour utilisateur sur ces fenêtres.

## Fiscal : fiche de course cliquable dans le détail du mois

**Reporté depuis :** Phase 14.1 (2026-10-02), décision utilisateur.
**État actuel :** la ligne du détail du mois montre la date, le client, le mode, HT et TVA. Les remboursements sont
distingués (libellé, montants négatifs, export CSV typé et signé) depuis la 14.1.
**À faire :** rendre la ligne cliquable, avec une fiche en modal : trajet, horaires, montants (HT, TVA, TTC),
mode de paiement, statut, remboursement lié, lien vers la facture ou l'avoir. À faire avec le modal générique
ci-dessus, lors de la migration de la page `ledger` (Phase 16).

**Déclencheur pour rouvrir :** migration de `ledger` en React, ou demande de l'expert-comptable du premier client.

## Première connexion guidée (React) : liste des éléments obligatoires, étape par étape

**Noté le :** 2026-10-02, décision utilisateur, pendant la Phase 14.1.
**Idée :** à la première connexion, le propriétaire doit renseigner ce qui est **obligatoire pour que l'application
tourne** (par exemple : coordonnées et mentions légales du tenant, tarifs de départ, véhicule, profil chauffeur,
compte de paiement). On en fait une **liste** guidée, **étape par étape**, avec des animations qui mettent le focus sur
ce qui reste à remplir.
**À faire :** dresser d'abord la liste exacte des prérequis (à partir de l'assistant `/app/setup` actuel et de ce que
`create_checkout_session`, les factures et le grand livre exigent), puis concevoir le parcours en React lors de la
Phase 16 (pages en React).

**Déclencheur pour rouvrir :** démarrage de la Phase 16, ou première installation d'un client réel (le script
d'installation d'instance crée le tenant et le propriétaire, pas ces éléments).

## Mise à disposition longue : conflits de créneaux et transfert à un collègue

**Noté le :** 2026-10-02, décision utilisateur, pendant la Phase 14.1 (plan 05).
**Contexte :** une mise à disposition peut durer une semaine (le plan 05 plafonne aujourd'hui `duration_hours` à 24 h). Si un
transfert arrive pendant ce créneau, le chauffeur doit soit l'annuler (remboursement existant), soit l'envoyer à un collègue.
**Dans la Phase 14.1 :** contrôle de chevauchement à la validation d'un devis et alerte de conflit dans le backoffice (voir plan 05).
**Reporté :** « transférer la course à un collègue » (flux d'affectation à un autre chauffeur, avec acceptation), et le blocage
des créneaux déjà pris directement dans le tunnel de réservation des clients.

**Déclencheur pour rouvrir :** premier chauffeur avec plusieurs véhicules ou collègues, ou premier conflit réel de créneau.

## Calendrier de disponibilités (créneaux pris) pour la mise à disposition et les transferts

**Noté le :** 2026-10-02, décision utilisateur, pendant la Phase 14.1 (plan 05). Remplace l'idée d'une durée plafonnée.
**Idée :** un calendrier des créneaux pris (courses acceptées, mises à disposition, périodes bloquées à la main : congés,
repos), par chauffeur ou par véhicule, qui sert de base unique au contrôle de chevauchement. La durée d'une mise à
disposition n'est pas bornée (une semaine ou plus) : on saisit une période (début, fin) plutôt qu'un nombre d'heures.
**Affichage :** pour le chauffeur, dans le backoffice (React, Phase 16). Pour le client, **orientation du 2026-10-02 : un
calendrier dans le tunnel des réservations à paiement immédiat (Transfert), avec les créneaux déjà pris grisés**, parce qu'une
course payée puis refusée est la pire expérience. Pas de calendrier pour les devis (aucun paiement, le chauffeur valide à la
main). Réserve du chauffeur : un client qui voit le chauffeur toujours complet peut ne pas revenir.
**Compromis à étudier :** réglage par chauffeur (afficher ou non ses disponibilités) ; ne griser que les **jours entièrement
indisponibles** (mise à disposition longue, congés) et vérifier le créneau exact en silence au paiement ; ne jamais exposer la
raison de l'indisponibilité ni le détail des courses.
**Prérequis de données :** une heure de fin pour **toutes** les courses (aujourd'hui seules les mises à disposition ont
`duration_hours` ; il faudrait une durée estimée par trajet fixe et une marge entre deux courses) ; plusieurs chauffeurs ou
véhicules : disponible s'il en reste un de libre.
**Dans la Phase 14.1 :** seulement le contrôle de chevauchement côté base (début + `duration_hours`, sans plafond de 24 h) et
l'alerte de conflit. Le calendrier visuel et le blocage dans le tunnel sont reportés.

**Déclencheur pour rouvrir :** démarrage de la Phase 16 (pages en React), ou premier conflit réel de créneau.

## Business (B2B) : demi-journée, journée, semaine, mois, avec facture électronique

**Noté le :** 2026-10-02, décision utilisateur, pendant la Phase 14.1 (plan 05).
**Idée :** le tunnel Business fonctionne comme la mise à disposition, avec des forfaits entreprise : demi-journée, journée,
semaine, mois. Il s'adresse à des entreprises et suppose la **facture électronique** (réforme française de la facturation
électronique, calendrier et obligations à faire confirmer par l'expert-comptable).
**Décision :** on le met de côté tant que la facture électronique n'existe pas. Dans la 14.1, le tunnel Business n'est pas
exposé aux clients.
**À faire :** forfaits (demi-journée, journée, semaine, mois) avec kilométrage inclus éventuel, devis, puis émission d'une
facture électronique conforme.

**Déclencheur pour rouvrir :** mise en place de la facture électronique, ou première demande d'une entreprise.

## Simplification des rôles : retirer `manager`, garder `owner` et `driver`

**Noté le :** 2026-10-02, décision utilisateur, pendant la Phase 14.1. Moment non fixé.
**Constat :** le rôle `manager` est déjà **inatteignable** : la Phase 9 a retenu le mode solo comme chemin nominal (`approve_onboarding_tx`
crée le tenant et le profil `owner`), le multi-chauffeurs et `manager` sont renvoyés à un milestone dédié, et aucun écran
n'attribue ce rôle. Les profils locaux ne contiennent que des `owner`.
**Étendue d'un retrait propre :** l'énumération `tenant_role` contient `manager` ; environ 42 lignes dans 13 migrations
(politiques RLS, RPC), 2 Edge Functions, 8 suites SQL, 9 fichiers du backoffice (`guards.ts`, `AppLayout`, `env.d.ts`, `bookings`,
etc.). Postgres ne sait pas retirer une valeur d'une énumération : il faut recréer le type et réécrire les objets qui en dépendent.
**Plan en 4 temps :** (1) interdire l'attribution de `manager` ; (2) réécrire politiques et RPC sur `owner` et `driver` (les
vérifications « owner ou manager » des plans 02, 03, 04 et 05 deviennent « owner ») ; (3) recréer l'énumération sans `manager` ;
(4) aligner types, backoffice et suites SQL. Un plan, après la Phase 14.1, avant la Phase 15.
**Pas dans la 14.1 :** le rôle est inoffensif aujourd'hui, et le retirer maintenant invaliderait les suites SQL tout juste
validées pour un gain nul auprès du premier client.
**Question produit à garder en tête :** sans `manager`, un assistant ou un régulateur d'agence ne peut pas avoir de compte
distinct du propriétaire. Le premier client est un chauffeur : pas de conflit.

**Déclencheur pour rouvrir :** fin de la Phase 14.1, ou première demande d'un compte non-chauffeur.
