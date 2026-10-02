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
