import { supabase } from "./supabase";

/**
 * Soumission d'une demande de devis
 */
export async function submitQuoteRequest(data: {
  pickup: string;
  destination: string;
  date: string;
  time: string;
  category: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  tenantId: string;
}) {
  // 1. Préparation de la date
  const pickupTime = new Date(`${data.date}T${data.time}`);

  // 2. Insertion dans la table bookings
  const { data: booking, error } = await supabase
    .from("bookings")
    .insert([
      {
        original_tenant_id: data.tenantId,
        current_tenant_id: data.tenantId,
        client_name: `${data.firstName} ${data.lastName}`,
        pickup_address: data.pickup,
        dropoff_address: data.destination,
        pickup_time: pickupTime.toISOString(),
        status: "pending",
        total_amount: 0, // 0 signifie "Sur devis" ou "A calculer"
        payment_mode: "cash",
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Erreur lors de la création du booking:", error);
    return { success: false, error: error.message };
  }

  // TODO: Déclencher une notification email ici si nécessaire

  return { success: true, booking };
}
