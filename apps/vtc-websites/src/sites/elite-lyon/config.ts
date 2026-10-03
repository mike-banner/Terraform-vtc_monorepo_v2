// Site de démonstration (D-29 a) : aucun domaine ; servi comme site par défaut de l'instance du développeur.
import type { ConfigSite } from "../../core/site-config";

export default {
  tenantId: "5750a0b3-4c6c-4782-b137-830a49e32249", // tenant de démonstration du développeur (D-30)
  nom: "Elite Lyon",
  longueDistanceVilleDepart: "Lyon",
  longueDistanceDestinations: [
    { ville: "Paris", distanceKm: 465, duree: "4h30" },
    { ville: "Marseille", distanceKm: 315, duree: "3h" },
    { ville: "Nice", distanceKm: 470, duree: "4h45" },
    { ville: "Bordeaux", distanceKm: 550, duree: "5h30" },
    { ville: "Strasbourg", distanceKm: 490, duree: "5h" },
    { ville: "Toulouse", distanceKm: 540, duree: "5h15" },
  ],
  longueDistancePlaceholderDestination: "Ex: Montpellier, Lille, Genève...",
  longueDistancePlaceholderDepart: "Ex: 1 Place Bellecour, Lyon",
  businessPlaceholderLieu: "Ex: Eurexpo Lyon, Centre de Congrès, Siège social...",
  businessPlaceholderEvenement: "Ex: Salon de l'Agriculture, Réunion Annuelle...",
  dispoPlaceholderItineraire: "Ex: 1. Visite du Château de Versailles 2. Déjeuner au restaurant X 3. Retour à Paris...",
} satisfies Partial<ConfigSite>;
