// src/lib/pricing-engine.ts
import { supabase } from "../core/supabase";

/**
 * Cette fonction cherche si une adresse contient le nom d'une zone configurée
 */
async function findZoneId(address: string, tenantId: string) {
  const trimmedAddress = address.trim().toLowerCase();

  const { data: zones } = await supabase
    .from("zones")
    .select("id, name")
    .eq("tenant_id", tenantId);

  if (!zones) return null;

  // On cherche si un mot-clé (ex: "CDG") est présent dans l'adresse tapée
  const matchedZone = zones.find((zone) =>
    trimmedAddress.includes(zone.name.trim().toLowerCase()),
  );

  return matchedZone ? matchedZone.id : null;
}

/**
 * Cherche une zone par son ID
 */
async function findZoneById(id: string, tenantId: string) {
  const { data: zone } = await supabase
    .from("zones")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();
  return zone ? zone.id : null;
}

/**
 * Calcule le prix final
 */
export async function calculateTripPrice(
  pickup: string,
  dropoff: string,
  category: string,
  tenantId: string,
) {
  // Détection auto : si c'est un UUID (36 chars), on cherche par ID, sinon par Nom
  const pickupZoneId =
    pickup.length === 36
      ? await findZoneById(pickup, tenantId)
      : await findZoneId(pickup, tenantId);
  const dropoffZoneId =
    dropoff.length === 36
      ? await findZoneById(dropoff, tenantId)
      : await findZoneId(dropoff, tenantId);

  if (pickupZoneId && dropoffZoneId) {
    // TENTATIVE 1 : Sens normal
    const { data: fixedRoute } = await supabase
      .from("fixed_routes")
      .select("price")
      .eq("tenant_id", tenantId)
      .eq("pickup_zone_id", pickupZoneId)
      .eq("dropoff_zone_id", dropoffZoneId)
      .eq("vehicle_category", category)
      .eq("active", true)
      .single();

    if (fixedRoute) return fixedRoute.price;

    // TENTATIVE 2 : Sens inverse (si bi-directionnel)
    const { data: reverseRoute } = await supabase
      .from("fixed_routes")
      .select("price")
      .eq("tenant_id", tenantId)
      .eq("pickup_zone_id", dropoffZoneId)
      .eq("dropoff_zone_id", pickupZoneId)
      .eq("vehicle_category", category)
      .eq("is_bidirectional", true)
      .eq("active", true)
      .single();

    if (reverseRoute) return reverseRoute.price;
  }

  return null;
}
