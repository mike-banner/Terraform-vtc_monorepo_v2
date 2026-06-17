import { supabase } from "@/lib/supabase/client";

export const getDrivers = async (tenantId: string) => {
  const { data, error } = await supabase
    .from("drivers")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};

export const createDriver = async (driver: {
  tenant_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  license_number: string;
  user_id?: string;
}) => {
  const { data, error } = await supabase
    .from("drivers")
    .insert([driver])
    .select()
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const updateDriver = async (id: string, updates: any) => {
  const { data, error } = await supabase
    .from("drivers")
    .update(updates)
    .eq("id", id)
    .select()
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const deleteDriver = async (id: string) => {
  const { error } = await supabase.from("drivers").delete().eq("id", id);
  if (error) throw error;
};

export const initializePrimaryDriver = async (
  tenantId: string,
  userId: string,
) => {
  try {
    // 1. Vérifier si un chauffeur existe déjà pour ce tenant

    const { count, error: countError } = await supabase
      .from("drivers")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    if (countError) throw countError;
    if (count && count > 0)
      return { success: false, message: "Un chauffeur existe déjà." };

    // 2. Récupérer les infos de l'onboarding pour avoir la licence Pro et le phone
    const { data: onboarding, error: onboardingError } = await supabase
      .from("onboarding")
      .select("*")
      .eq("profile_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (onboardingError) throw onboardingError;
    if (!onboarding)
      throw new Error(
        "Données d'onboarding introuvables. Veuillez compléter votre profil.",
      );

    // 3. Créer le chauffeur principal
    const primaryDriver = {
      tenant_id: tenantId,
      first_name: onboarding.first_name,
      last_name: onboarding.last_name,
      phone: onboarding.phone,
      license_number: onboarding.vtc_license_number,
      user_id: userId,
    };

    const { data, error: insertError } = await supabase
      .from("drivers")
      .insert([primaryDriver])
      .select()
      .limit(1)
      .maybeSingle();

    if (insertError) throw insertError;

    return { success: true, data };
  } catch (err: any) {
    console.error("Error in initializePrimaryDriver:", err);
    return { success: false, error: err.message };
  }
};
