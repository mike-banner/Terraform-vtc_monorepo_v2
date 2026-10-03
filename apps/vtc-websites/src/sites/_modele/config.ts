// Champs disponibles et valeurs neutres : CONFIG_NEUTRE dans src/core/site-config.ts. tenantId : identifiant du
// tenant de ce site (imprimé par scripts/seed-instance.mjs), repli quand le domaine ne le trouve pas.
import type { ConfigSite } from "../../core/site-config";

export default { tenantId: "", nom: "" } satisfies Partial<ConfigSite>;
