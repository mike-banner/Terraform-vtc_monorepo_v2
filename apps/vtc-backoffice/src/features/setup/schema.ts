import { z } from "zod";

export const LEGAL_FORMS = [
  ["auto_entrepreneur", "Auto-entrepreneur"],
  ["sasu", "SASU"],
  ["eurl", "EURL"],
  ["sarl", "SARL"],
  ["sas", "SAS"],
  ["ei", "Entreprise individuelle"],
] as const;
export type LegalForm = (typeof LEGAL_FORMS)[number][0];

/** Formes sans capital, sans RCS ni TVA saisie (franchise ou micro) : mêmes règles que la RPC (TVA ignorée pour auto_entrepreneur et ei). */
export const isMicro = (f: string) => f === "auto_entrepreneur" || f === "ei";

const digits = (s: string) => s.replace(/\D/g, "");

export const legalSchema = z
  .object({
    legal_form: z.enum(LEGAL_FORMS.map((f) => f[0]) as [LegalForm, ...LegalForm[]]),
    siret: z.string().refine((v) => digits(v).length === 14, "Le SIRET compte 14 chiffres."),
    vtc_license_number: z.string().refine((v) => digits(v).length === 12, "La carte professionnelle VTC compte 12 chiffres."),
    rcs_number: z.string().trim(),
    capital_social: z.string().trim(),
    vat_number: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    if (isMicro(v.legal_form)) return;
    if (!/^RCS [A-Za-zÀ-ÿ\- ]+ [0-9 ]{9,14}$/i.test(v.rcs_number)) ctx.addIssue({ code: "custom", path: ["rcs_number"], message: "Format attendu : RCS PARIS 123 456 789." });
    if (v.capital_social === "" || !(Number(v.capital_social) >= 0)) ctx.addIssue({ code: "custom", path: ["capital_social"], message: "Le capital social est obligatoire." });
    if (digits(v.vat_number).length !== 11) ctx.addIssue({ code: "custom", path: ["vat_number"], message: "Le numéro de TVA compte 11 chiffres après FR." });
  });
export type LegalValues = z.infer<typeof legalSchema>;

export type LegalPayload = {
  legal_form: LegalForm;
  siret: string;
  vtc_license_number: string;
  rcs_number: string | null;
  capital_social: number | null;
  vat_number: string | null;
};

/** Valeurs de formulaire -> corps de la RPC. La TVA est dérivée en base de la forme juridique (trg_sync_tenant_vat). */
export function toLegalPayload(v: LegalValues): LegalPayload {
  const micro = isMicro(v.legal_form);
  return {
    legal_form: v.legal_form,
    siret: digits(v.siret),
    vtc_license_number: digits(v.vtc_license_number),
    rcs_number: v.rcs_number ? v.rcs_number.toUpperCase() : null,
    capital_social: micro || v.capital_social === "" ? null : Number(v.capital_social),
    vat_number: micro ? null : `FR${digits(v.vat_number)}`,
  };
}
