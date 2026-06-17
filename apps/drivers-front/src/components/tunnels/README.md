# Architecture des Tunnels de Conversion VTC

## Structure des Tunnels

### 1. Layout Commun (`TunnelLayout.astro`)
- Header avec barre de progression
- Navigation entre étapes
- Footer avec boutons d'action
- Design responsive et cohérent

### 2. Barre de Progression (`TunnelProgress.astro`)
- Indicateur visuel des étapes
- États : complété, actif, à venir
- Animation fluide entre les étapes

### 3. Tunnels Spécifiques

#### A. Transfert (`AirportTunnel.astro`)
**Étapes :**
1. Sélection de la destination / gare / aéroport (CDG, ORY, LYS, GVA, etc.)
2. Type de véhicule (Berline, Business, Van)
3. Date/Heure
4. Adresses de départ/arrivée

**Fonctionnalités :**
- Sélection dynamique des gares, aéroports et destinations prédéfinies
- Estimation de distance/temps
- Prix selon véhicule

#### B. Longue Distance (`LongDistanceTunnel.astro`)
**Étapes :**
1. Destination (villes populaires ou personnalisée)
2. Type de service (Aller simple, Aller-retour, Multi-jours)
3. Dates et durée estimée
4. Détails supplémentaires

**Fonctionnalités :**
- Destinations pré-calculées
- Options de service flexibles
- Notes spéciales pour arrêts

#### C. Business & B2B (`BusinessTunnel.astro`)
**Étapes :**
1. Forfait (À l'heure, Journée, Mensuel)
2. Véhicule (Executive, SUV, Van)
3. Planning et horaires
4. Informations entreprise

**Fonctionnalités :**
- Facturation entreprise
- Planning flexible
- Options corporate

#### D. Mise à Disposition (`AvailabilityTunnel.astro`)
**Étapes :**
1. Durée (Demi-journée, Journée, Étendue)
2. Type d'utilisation (Shopping, Événements, Médical, etc.)
3. Date et horaires
4. Détails et préférences

**Fonctionnalités :**
- Cas d'usage prédéfinis
- Équipements spéciaux
- Langues parlées

## URLs des Tunnels

```
/tunnels/transfert        # Transfert (prédéfinis, gares, aéroports)
/tunnels/long-distance    # Longue Distance
/tunnels/business         # Business & B2B
/tunnels/availability     # Mise à Disposition
```

## Intégration avec la Page d'Accueil

Les 4 tunnels correspondent aux 4 services de la section "Nos Prestations" :

1. **Transferts** → `/tunnels/transfert`
2. **Longue Distance** → `/tunnels/long-distance`
3. **Business & B2B** → `/tunnels/business`
4. **Mise à Disposition** → `/tunnels/availability`

## Points Techniques

### Design System
- Couleurs par service (bleu, vert, violet, orange)
- Typographie cohérente
- Micro-interactions (hover, focus, validation)

### Responsive Design
- Mobile-first
- Grilles flexibles
- Éléments adaptatifs

### Accessibilité
- Labels ARIA
- Navigation clavier
- Contraste des couleurs

### Performance
- Composants Astro optimisés
- Images optimisées
- Chargement progressif

## Prochaines Étapes

1. **Intégration Backend**
   - Connexion à l'API de réservation
   - Validation des formulaires
   - Envoi des données

2. **Personnalisation Avancée**
   - Calcul de prix en temps réel
   - Disponibilité des véhicules
   - Suggestions personnalisées

3. **Analytics**
   - Tracking des conversions
   - Analyse des abandons
   - Optimisation des tunnels
```