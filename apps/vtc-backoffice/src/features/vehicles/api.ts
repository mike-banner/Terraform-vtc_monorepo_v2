import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rpc } from "@/lib/app-error";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@vtc/database";
import type { VehicleValues } from "./schema";

export type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];

export const vehicleKeys = { all: (tenantId: string) => ["vehicles", tenantId] as const };

export async function listVehicles(tenantId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase.from("vehicles").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Création atomique (RPC A-06) : un véhicule actif désactive les autres dans la même transaction. */
export async function createVehicle(v: VehicleValues): Promise<string> {
  const id = await rpc<string>("create_vehicle", {
    p_brand: v.brand,
    p_model: v.model,
    p_plate_number: v.plate_number,
    p_category: v.category,
    p_capacity: v.capacity,
    p_status: v.status,
  });
  // La RPC ne porte pas les bagages (valeur par défaut 3) ; écriture sans effet sur les statuts.
  if (v.luggage_capacity !== 3) {
    const { error } = await supabase.from("vehicles").update({ luggage_capacity: v.luggage_capacity }).eq("id", id);
    if (error) throw error;
  }
  return id;
}

export async function updateVehicle(id: string, v: VehicleValues): Promise<void> {
  // ponytail: pas de RPC de mise à jour ; activer un véhicule existant désactive les autres en deux écritures (non atomique), un RPC update_vehicle réglerait cela.
  if (v.status === "active") {
    const { error: e } = await supabase.from("vehicles").update({ status: "inactive" }).eq("status", "active").neq("id", id);
    if (e) throw e;
  }
  const { error } = await supabase.from("vehicles").update(v).eq("id", id);
  if (error) throw error;
}

export async function deleteVehicle(id: string): Promise<void> {
  const { error } = await supabase.from("vehicles").delete().eq("id", id);
  if (error) throw error;
}

export const useVehicles = (tenantId: string | null | undefined) =>
  useQuery({ queryKey: vehicleKeys.all(tenantId ?? ""), enabled: !!tenantId, queryFn: () => listVehicles(tenantId!) });

function useVehicleMutation<A>(tenantId: string, fn: (a: A) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: vehicleKeys.all(tenantId) }) });
}

export const useCreateVehicle = (tenantId: string) => useVehicleMutation(tenantId, createVehicle);
export const useUpdateVehicle = (tenantId: string) => useVehicleMutation(tenantId, (a: { id: string; values: VehicleValues }) => updateVehicle(a.id, a.values));
export const useDeleteVehicle = (tenantId: string) => useVehicleMutation(tenantId, deleteVehicle);
