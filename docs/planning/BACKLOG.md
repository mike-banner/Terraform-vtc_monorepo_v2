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
