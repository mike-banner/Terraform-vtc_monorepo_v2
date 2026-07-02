# ADR-001: Authentification & Onboarding en Staging

## Contexte
L'inscription utilisateur et la création de l'entreprise doivent être sécurisées et validées manuellement pour éviter le spam et les faux comptes chauffeurs.

## Décision
- L'inscription crée un profil en statut `pending`.
- Les données d'entreprise et de véhicule sont écrites dans une table intermédiaire `onboarding` (staging).
- Un processus d'approbation Super Admin valide le dossier via une transaction atomique SQL `approve_onboarding_tx()`, qui transfère les données vers les tables de production (`tenants`, `drivers`, `vehicles`) et active le profil.

## Statut
Accepté et implémenté.
