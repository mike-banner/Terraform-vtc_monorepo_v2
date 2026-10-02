Tunnels communs à tous les sites (D-29) : aucun texte, lieu ou contact d'un client ; ce qui varie se lit dans `configDuSite(Astro.url.host)` (`src/core/site-config.ts`), valeurs neutres par défaut. Route : `src/pages/tunnels/[...slug].astro`.

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

#### A. Transfert (`TransfertTunnel.astro`)
**Étapes :**
1. Sélection de la destination / gare / aéroport (trajets du tenant, table fixed_routes)
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

#### C. Business & B2B (`BusinessTunnel.astro`) : mis de côté (D-35), non exposé
Le composant reste sur disque, non branché (aucune route, aucun lien).

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
À l'heure, période début-fin, sur devis (aucun plafond de durée hors limite d'un an). Enregistre une demande (`submit_booking_request`), sans estimation de prix dans le navigateur.

**Étapes :**
1. Période (début, fin) et lieu de prise en charge
2. Véhicule
3. Programme (itinéraire, options, notes)
4. Coordonnées

Longue distance (`LongDistanceTunnel.astro`) : même principe, demande sur devis.

## URLs des Tunnels

```
/tunnels/transfert        # Transfert (prédéfinis, gares, aéroports)
/tunnels/long-distance    # Longue Distance
/tunnels/availability     # Mise à Disposition
```

## Intégration avec la Page d'Accueil

Les tunnels exposés correspondent aux services de la section "Nos Prestations" :

1. **Transferts** → `/tunnels/transfert`
2. **Longue Distance** → `/tunnels/long-distance`
3. **Mise à Disposition** → `/tunnels/availability`

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