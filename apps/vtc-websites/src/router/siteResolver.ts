// Choix du site par domaine (ADR 0003, D-28/D-29) : la table vient de SITE_MAP à la compilation (module virtuel) ;
// aucun domaine dans le dépôt public. Domaine inconnu (preview *.pages.dev, localhost) : site par défaut PUBLIC_SITE.
import { siteMap, defaultSite } from "virtual:vtc-sites";

export function resolveSite(host: string): string {
  const sansPort = host.replace(/:\d+$/, "");
  const cle = [host, sansPort].find((h) => Object.hasOwn(siteMap, h));
  return cle ? siteMap[cle] : defaultSite;
}
