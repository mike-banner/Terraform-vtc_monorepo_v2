import { COMPANY_FORMS, EMPTY_VALUES, type CompanyForm, type SignupValues } from "./schemas";

/** Ligne `onboarding` lue sous RLS (profile_id = auth.uid()). */
export type OnboardingRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  primary_domain?: string | null;
  siret?: string | null;
  vtc_license_number?: string | null;
  legal_form?: string | null;
  company_type?: string | null;
  phone?: string | null;
};

/** Connecté : compte déjà créé, on reprend à l'étape 2 (index 1). Sinon étape 1. */
export const resumeStep = (state: { signedIn: boolean }): 0 | 1 => (state.signedIn ? 1 : 0);

const PREFIXES = ["+33", "+32", "+41"];

export function splitPhone(phone: string | null | undefined): { phone_prefix: string; phone_number: string } {
  const p = phone ?? "";
  const prefix = PREFIXES.find((x) => p.startsWith(x));
  return prefix ? { phone_prefix: prefix, phone_number: p.slice(prefix.length) } : { phone_prefix: "+33", phone_number: p };
}

/** Préremplit le formulaire depuis un dossier existant. */
export function prefill(email: string, row: OnboardingRow | null): SignupValues {
  const base = { ...EMPTY_VALUES, email };
  if (!row) return base;
  const form = row.legal_form || (row.company_type === "auto_entrepreneur" ? "auto_entrepreneur" : row.company_type ? "sasu" : "");
  return {
    ...base,
    first_name: row.first_name ?? "",
    last_name: row.last_name ?? "",
    company_name: row.company_name ?? "",
    primary_domain: row.primary_domain ?? "",
    siret: row.siret ?? "",
    vtc_license_number: row.vtc_license_number ?? "",
    ...(form === "auto_entrepreneur" ? { kind: "auto_entrepreneur" as const } : COMPANY_FORMS.some((f) => f[0] === form) ? { company_form: form as CompanyForm } : {}),
    ...splitPhone(row.phone),
  };
}
