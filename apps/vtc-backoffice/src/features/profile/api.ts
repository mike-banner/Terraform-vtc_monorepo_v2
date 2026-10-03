import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

/** Identité de l'entreprise affichée sur le profil (lecture seule). */
export const useTenantIdentity = (tenantId: string | null | undefined) =>
  useQuery({
    queryKey: ["tenant", tenantId, "identity"],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("name, logo_url, siret, rcs_number, vat_number, legal_form")
        .eq("id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
