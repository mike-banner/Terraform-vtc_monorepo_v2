// Sites compilés dans une instance (ADR 0003, D-28/D-29/D-30) : PUBLIC_SITE = site par défaut, SITE_MAP = domaine=code,
// un domaine par site, un tenant par site.
// Les messages d'erreur ne contiennent jamais de domaine : la table identifie un client et peut finir dans un journal.
const CODE = /^[a-z0-9_-]{2,40}$/;
const DOMAINE = /^[a-z0-9.-]+(:\d+)?$/;

export function lireSites(env) {
  const defaultSite = (env.PUBLIC_SITE ?? "").trim();
  if (!CODE.test(defaultSite)) {
    throw new Error("PUBLIC_SITE obligatoire à la compilation (code du site par défaut, motif [a-z0-9_-]{2,40}).");
  }
  const siteMap = {};
  const codesVus = new Set();
  const entrees = (env.SITE_MAP ?? "").split(",").map((e) => e.trim()).filter(Boolean);
  entrees.forEach((entree, i) => {
    const n = i + 1;
    const parts = entree.split("=");
    if (parts.length !== 2 || !DOMAINE.test(parts[0]) || !CODE.test(parts[1])) {
      throw new Error(`SITE_MAP : entrée n°${n} invalide (attendu domaine=code).`);
    }
    const [domaine, code] = parts;
    if (Object.hasOwn(siteMap, domaine)) throw new Error(`SITE_MAP : entrée n°${n} : domaine en double.`);
    if (codesVus.has(code)) throw new Error(`SITE_MAP : entrée n°${n} : site déjà associé à un domaine (un domaine par site).`);
    siteMap[domaine] = code;
    codesVus.add(code);
  });
  return { defaultSite, siteMap, codes: [...new Set([defaultSite, ...codesVus])] };
}
