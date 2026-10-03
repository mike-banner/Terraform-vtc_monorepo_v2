import { supabase } from "@/lib/supabase/client";
import { digits, legalFormOf, type SignupValues } from "./schemas";
import type { OnboardingRow } from "./resume";

/** Session éventuelle + dossier existant (RLS : seulement le sien). */
export async function loadOnboardingState(): Promise<{ userId: string; email: string; onboarding: OnboardingRow | null } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("onboarding").select("*").eq("profile_id", user.id).maybeSingle();
  return { userId: user.id, email: user.email ?? "", onboarding: (data as OnboardingRow | null) ?? null };
}

const fail = (m: string): never => {
  throw new Error(m);
};

/**
 * Inscription finale : signUp si pas de session, contrôles d'unicité, puis insert/update de onboarding
 * (même ordre et mêmes écritures que l'ancienne page). Le statut `pending` et le rôle sont validés côté serveur (RLS, approve_onboarding_tx).
 */
export async function submitSignup(v: SignupValues, existing: { userId: string; onboarding: OnboardingRow | null } | null): Promise<void> {
  let userId = existing?.userId;
  if (!userId) {
    const { data, error } = await supabase.auth.signUp({ email: v.email, password: v.password });
    if (error) throw error;
    userId = data.user?.id ?? fail("Erreur lors de la création de l'utilisateur");
  }
  const current = existing?.onboarding ?? null;
  const row = {
    profile_id: userId,
    first_name: v.first_name,
    last_name: v.last_name,
    company_name: v.company_name,
    primary_domain: v.primary_domain,
    phone: `${v.phone_prefix}${digits(v.phone_number)}`,
    vtc_license_number: digits(v.vtc_license_number),
    siret: digits(v.siret),
    legal_form: legalFormOf(v),
    status: "pending" as const,
  };

  const domain = await supabase.from("tenants").select("id").eq("primary_domain", row.primary_domain).maybeSingle();
  if (domain.data) fail(`Le domaine "${row.primary_domain}" est déjà réservé.`);

  const otherDossier = async (col: "siret" | "vtc_license_number") => {
    const { data } = await supabase.from("onboarding").select("id").eq(col, row[col]).neq("status", "rejected").maybeSingle();
    return Boolean(data && (!current || data.id !== current.id));
  };
  if (await otherDossier("siret")) fail("Ce numéro SIRET est déjà associé à un dossier en cours ou validé.");
  const tenantSiret = await supabase.from("tenants").select("id").eq("siret", row.siret).maybeSingle();
  if (tenantSiret.data) fail("Ce numéro SIRET est déjà enregistré sur la plateforme.");
  if (await otherDossier("vtc_license_number")) fail("Cette carte VTC est déjà associée à un dossier en cours ou validé.");
  const driver = await supabase.from("drivers").select("id").eq("license_number", row.vtc_license_number).maybeSingle();
  if (driver.data) fail("Cette carte VTC est déjà enregistrée sur la plateforme.");

  const res = current ? await supabase.from("onboarding").update(row).eq("id", current.id) : await supabase.from("onboarding").insert(row);
  if (res.error) throw res.error;
}
