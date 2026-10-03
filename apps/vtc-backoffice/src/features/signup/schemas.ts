import { z } from "zod";

export const digits = (s: string) => s.replace(/\D/g, "");

export const COMPANY_FORMS = [
  ["sasu", "SASU"],
  ["eurl", "EURL"],
  ["sarl", "SARL"],
  ["sas", "SAS"],
  ["ei", "Entreprise individuelle (EI)"],
  ["other", "Autre"],
] as const;
export type CompanyForm = (typeof COMPANY_FORMS)[number][0];

const account = z.object({
  email: z.string().trim().min(1, "Saisissez votre adresse e-mail.").email("Adresse e-mail invalide."),
  password: z.string().min(6, "Le mot de passe compte au moins 6 caractères."),
});

const profile = z.object({
  first_name: z.string().trim().min(1, "Saisissez votre prénom."),
  last_name: z.string().trim().min(1, "Saisissez votre nom."),
  phone_prefix: z.string(),
  phone_number: z.string().refine((v) => [9, 10].includes(digits(v).length), "Numéro de téléphone invalide."),
});

const business = z.object({
  kind: z.enum(["societe", "auto_entrepreneur"]),
  company_form: z.enum(COMPANY_FORMS.map((f) => f[0]) as [CompanyForm, ...CompanyForm[]]),
  company_name: z.string().trim().min(1, "Saisissez le nom de l'entreprise."),
  primary_domain: z.string().trim().min(1, "Saisissez le domaine web."),
  siret: z.string().refine((v) => digits(v).length === 14, "Le SIRET compte 14 chiffres."),
  vtc_license_number: z.string().refine((v) => digits(v).length === 12, "La carte VTC compte 12 chiffres."),
});

export const stepSchemas = [account, profile, business] as const;

export type SignupValues = z.infer<typeof account> & z.infer<typeof profile> & z.infer<typeof business>;

export const EMPTY_VALUES: SignupValues = {
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  phone_prefix: "+33",
  phone_number: "",
  kind: "societe",
  company_form: "sasu",
  company_name: "",
  primary_domain: "",
  siret: "",
  vtc_license_number: "",
};

/** Valeur de `legal_form` écrite en base (même règle que signup.astro). */
export const legalFormOf = (v: Pick<SignupValues, "kind" | "company_form">): CompanyForm | "auto_entrepreneur" => (v.kind === "auto_entrepreneur" ? "auto_entrepreneur" : v.company_form);
