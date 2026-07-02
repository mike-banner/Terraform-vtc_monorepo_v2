# ADR-006: Navigation Mobile-First & Smart Feedback Routing

## Contexte
La refonte mobile-first exige une simplification de l'interface pour un usage terrain (smartphone) :
1. L'ancien menu latéral (drawer) encombrait l'écran et nuisait à l'expérience utilisateur mobile.
2. Certains rôles (`driver`, `manager`, `owner`) ont des besoins différents, nécessitant une navigation adaptative.
3. Les avis clients doivent impérativement soutenir le référencement (SEO local) sur Google sans exposer publiquement les évaluations négatives des utilisateurs.

## Décision
- **Bottom Navigation Bar** : Remplacement du menu tiroir par une barre de navigation fixe de **5 boutons maximum** sur mobile.
- **Navigation Adaptative** :
  - `driver` : 3 boutons (Dashboard, Courses, Profil).
  - `manager` : 4 boutons (Dashboard, Courses, Compta, Profil).
  - `owner` : 5 boutons (Dashboard, Courses, Compta, Profil, Config).
- **Redirection Google Reviews (Smart Routing)** :
  - Les notes de **4 ou 5 étoiles** redirigent le passager vers le lien Google Business Profile du tenant pour maximiser le SEO local.
  - Les notes de **1 à 3 étoiles** restent purement internes et sauvegardées dans la table `bookings` pour actions correctives du manager, évitant la dégradation de l'e-réputation publique.
- **Génération Locale de QR Code** : Utilisation du package npm `qrcode` côté client (vanilla JS) pour dessiner le code d'avis sur un `<canvas>` de façon 100% autonome et sécurisée (hors-ligne).

## Statut
Accepté et implémenté.
