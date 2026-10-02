// Configuration d'un site (D-29 d) : seuls ces champs varient d'un site à l'autre ; tunnels et pages fonctionnelles sont
// communs. Valeurs neutres par défaut : aucun nom, lieu, e-mail ni téléphone de client.
// Ces valeurs sont affichées par Astro (échappement par défaut), jamais par set:html.
import { configs } from "virtual:vtc-sites";
import { resolveSite } from "../router/siteResolver";

export const CONFIG_NEUTRE = {
  tenantId: "", // D-30 : tenant du site, repli si le domaine ne le trouve pas (prévisualisation)
  nom: "", // nom affiché si le tenant n'est pas résolu ; "" = rien
  email: "", // contact de repli si le tenant n'en a pas ; "" = masqué
  telephone: "",
  transfertPlaceholderAdresse: "Ex : adresse complète",
  longueDistanceVilleDepart: "", // "" = pas de « Depuis … » ni de ville dans les libellés
  longueDistanceDestinations: [] as { ville: string; distanceKm: number; duree: string }[], // [] = saisie libre seulement
  longueDistancePlaceholderDestination: "Ex : ville de destination",
  longueDistancePlaceholderDepart: "Ex : adresse complète de prise en charge",
  businessPlaceholderLieu: "Ex : lieu de l'événement, siège social…",
  businessPlaceholderEvenement: "Ex : salon, séminaire, réunion…",
  dispoPlaceholderItineraire: "Ex : étapes prévues, horaires, retour…",
};

export type ConfigSite = typeof CONFIG_NEUTRE;

export function configDuSite(host: string): ConfigSite {
  return { ...CONFIG_NEUTRE, ...configs[resolveSite(host)] };
}
