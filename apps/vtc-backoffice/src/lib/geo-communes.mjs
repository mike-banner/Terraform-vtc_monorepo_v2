// Aide à la saisie des codes postaux d'une zone (geo.api.gouv.fr). Aucune règle métier ici : le serveur décide.

const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "");

const libelle = (c) => `${c.nom} (${c.departement?.nom ?? "département inconnu"}, ${c.departement?.code ?? "?"})`;

/**
 * Analyse la réponse de geo.api.gouv.fr pour le nom d'une zone :
 * - une seule commune au nom exact : ses codes et son libellé « Nom (Département, code) » à montrer au chauffeur ;
 * - plusieurs communes au nom exact (homonymes) : aucun code proposé, la liste des libellés ;
 * - dans tous les cas, jusqu'à 3 communes dont le nom commence par celui de la zone (ex. Évry-Courcouronnes pour « Evry »).
 */
export function analyserCommunes(nomZone, communes) {
  const cible = norm(nomZone);
  const liste = Array.isArray(communes) ? communes : [];
  const exactes = liste.filter((x) => norm(x?.nom) === cible && x?.codesPostaux?.length);
  const proches = liste.filter((x) => cible && norm(x?.nom) !== cible && norm(x?.nom).startsWith(cible)).slice(0, 3);
  return {
    codes: exactes.length === 1 ? [...exactes[0].codesPostaux] : [],
    commune: exactes.length === 1 ? libelle(exactes[0]) : null,
    homonymes: exactes.length > 1 ? exactes.map(libelle) : [],
    proches: proches.map(libelle),
  };
}

/** Codes de la commune dont le nom est exactement celui de la zone, sinon []. */
export function choisirCodesCommune(nomZone, communes) {
  return analyserCommunes(nomZone, communes).codes;
}

/** "75001, 75002;75003 " => ["75001","75002","75003"] ; lève si un code n'a pas 5 chiffres ou si plus de 50. */
export function analyserCodes(saisie) {
  const codes = [...new Set(String(saisie ?? "").split(/[\s,;]+/).filter(Boolean))];
  for (const c of codes) {
    if (!/^\d{5}$/.test(c)) throw new Error(`Code postal invalide : ${c}`);
  }
  if (codes.length > 50) throw new Error("Code postal invalide : 50 codes au plus par zone");
  return codes;
}
