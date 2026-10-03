export type SetupData = {
  tenant: { setup_completed: boolean | null; address_line: string | null; postal_code: string | null; city: string | null; stripe_account_id: string | null } | null;
  vehicles: { status: string }[];
  rules: { active: boolean | null }[];
  hasDriverProfile: boolean;
};

export type PrerequisiteId = "legal" | "address" | "vehicle" | "pricing" | "driver_profile" | "payment_account";

/** `blocking` : sans cet élément, une réservation ne peut pas être payée ni facturée correctement. */
export const PREREQUISITES: { id: PrerequisiteId; label: string; blocking: boolean }[] = [
  { id: "legal", label: "Identité légale et mentions", blocking: true },
  { id: "vehicle", label: "Un véhicule actif", blocking: true },
  { id: "pricing", label: "Un tarif actif", blocking: true },
  { id: "address", label: "Adresse de l'entreprise (factures)", blocking: false },
  { id: "driver_profile", label: "Profil chauffeur", blocking: false },
  { id: "payment_account", label: "Compte de paiement", blocking: false },
];

export type PrerequisiteStatus = { id: PrerequisiteId; label: string; done: boolean; blocking: boolean };

/** Booléens uniquement : aucun montant n'est lu ni calculé ici. */
export function prerequisiteStatus(d: SetupData): PrerequisiteStatus[] {
  const t = d.tenant;
  const done: Record<PrerequisiteId, boolean> = {
    legal: t?.setup_completed === true,
    address: !!(t?.address_line && t.postal_code && t.city),
    vehicle: d.vehicles.some((v) => v.status === "active"),
    pricing: d.rules.some((r) => r.active === true),
    driver_profile: d.hasDriverProfile,
    payment_account: !!t?.stripe_account_id,
  };
  return PREREQUISITES.map((p) => ({ ...p, done: done[p.id] }));
}

/** Même règle pour la page de configuration et SetupGate. */
export const isSetupComplete = (d: SetupData): boolean => prerequisiteStatus(d).every((p) => p.done || !p.blocking);
