import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rpc } from "@/lib/app-error";
import { supabase } from "@/lib/supabase/client";

export const settingsKey = (tenantId: string) => ["tenant", tenantId, "settings"] as const;

export type TenantSettings = {
  name: string;
  logo_url: string | null;
  legal_form: string | null;
  is_vat_exempt: boolean | null;
  vat_rate: number | null;
  vat_number: string | null;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
};

/** Les valeurs fiscales (TVA) sont relues telles que la base les a dérivées (trg_sync_tenant_vat). */
export async function getTenantSettings(tenantId: string): Promise<TenantSettings> {
  const { data, error } = await supabase
    .from("tenants")
    .select("name, logo_url, legal_form, is_vat_exempt, vat_rate, vat_number, address_line, postal_code, city")
    .eq("id", tenantId)
    .single();
  if (error) throw error;
  return data;
}

export const updateTenantSettings = (legalForm: string, vatNumber: string | null) =>
  rpc("update_tenant_settings", { p_legal_form: legalForm, ...(vatNumber ? { p_vat_number: vatNumber } : {}) });

export const updateTenantAddress = (address: string, postalCode: string, city: string) =>
  rpc("update_tenant_address", { p_address_line: address, p_postal_code: postalCode, p_city: city });

/** Téléverse dans Storage (même chemin qu'avant) puis enregistre l'URL par la RPC (garde owner + validation du chemin en base). */
export async function uploadLogo(tenantId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const path = `logos/${tenantId}/logo.${ext}`;
  // On supprime l'ancien logo puis on insère : l'extension peut changer (png, svg), donc le chemin aussi.
  await supabase.storage.from("assets").remove([path]);
  const { error } = await supabase.storage.from("assets").upload(path, file, { contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from("assets").getPublicUrl(path);
  return rpc<string>("update_tenant_logo", { p_url: `${data.publicUrl}?t=${Date.now()}` });
}

export const useTenantSettings = (tenantId: string | null | undefined) =>
  useQuery({ queryKey: settingsKey(tenantId ?? ""), enabled: !!tenantId, queryFn: () => getTenantSettings(tenantId!) });

export function useSaveSettings(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { legal_form: string; vat_number: string | null; address_line: string; postal_code: string; city: string }) => {
      await updateTenantSettings(v.legal_form, v.vat_number);
      if (v.address_line && v.postal_code && v.city) await updateTenantAddress(v.address_line, v.postal_code, v.city);
    },
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: settingsKey(tenantId) }), qc.invalidateQueries({ queryKey: ["tenant", tenantId] })]),
  });
}

export function useUploadLogo(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadLogo(tenantId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant", tenantId] }),
  });
}
