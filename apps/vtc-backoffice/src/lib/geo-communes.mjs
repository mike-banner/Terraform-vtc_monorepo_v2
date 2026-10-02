// Aide à la saisie des codes postaux d'une zone (geo.api.gouv.fr). Aucune règle métier ici : le serveur décide.

const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "");

/** Codes de la commune dont le nom est exactement celui de la zone, sinon []. */
export function choisirCodesCommune(nomZone, communes) {
  const cible = norm(nomZone);
  if (!cible || !Array.isArray(communes)) return [];
  const c = communes.find((x) => norm(x?.nom) === cible);
  return c?.codesPostaux ? [...c.codesPostaux] : [];
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
