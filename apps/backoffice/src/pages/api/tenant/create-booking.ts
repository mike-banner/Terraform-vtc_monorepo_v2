// src/pages/api/tenant/create-booking.ts
import type { APIRoute } from "astro";
import { calculatePrice, computeVat, findPricingRule } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * API pour créer une course avec calcul de prix automatisé côté serveur
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const {
      pickup,
      dropoff,
      distance_km,
      pickup_time,
      client_name,
      client_email,
      payment_mode,
      manual_total,
      booking_type,
      duration_hours,
      passenger_count,
      luggage_count,
      vehicle_id,
    } = body;

    const supabase = createAdminClient(locals);

    const { user, profile } = locals as any;
    if (!user || !profile) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    // Chauffeur obligatoire pour une création manuelle (driver connecté)
    const { data: driverFull, error: driverError } = await supabase
      .from("drivers")
      .select("id, vehicles(*)")
      .eq("tenant_id", profile.tenant_id)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (driverError) {
      return new Response(JSON.stringify({ error: driverError.message }), {
        status: 500,
      });
    }

    if (!driverFull?.id) {
      return new Response(
        JSON.stringify({
          error:
            "Profil chauffeur introuvable. Crée ton profil chauffeur avant de créer une course manuelle.",
        }),
        { status: 400 },
      );
    }

    const resolvedVehicleId =
      vehicle_id ||
      (Array.isArray((driverFull as any).vehicles)
        ? (driverFull as any).vehicles[0]?.id
        : (driverFull as any).vehicles?.id) ||
      null;

    if (!resolvedVehicleId) {
      return new Response(
        JSON.stringify({
          error:
            "Aucun véhicule associé à ton profil chauffeur. Ajoute/associe un véhicule avant de créer une course manuelle.",
        }),
        { status: 400 },
      );
    }

    // 1️⃣ Normalisation email
    const normalizedEmail = client_email.trim().toLowerCase();
    const tenantId = profile.tenant_id;

    // 2️⃣ Chercher customer existant
    let { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("email", normalizedEmail)
      .maybeSingle();

    let customerId = existingCustomer?.id;

    // 3️⃣ Créer si absent
    if (!customerId) {
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          tenant_id: tenantId,
          email: normalizedEmail,
          first_name: client_name.split(" ")[0],
          last_name: client_name.split(" ").slice(1).join(" ") || "",
          type: "individual",
        })
        .select("id")
        .limit(1)
        .maybeSingle();

      if (customerError) throw customerError;
      if (!newCustomer) throw new Error("Erreur lors de la création du client");
      customerId = newCustomer.id;
    }

    // Récupérer la config TVA du tenant
    const { data: tenantVat } = await supabase
      .from("tenants")
      .select("vat_rate, is_vat_exempt")
      .eq("id", tenantId)
      .maybeSingle();

    const vatRate   = Number(tenantVat?.vat_rate   ?? 0);
    const isExempt  = tenantVat?.is_vat_exempt !== false; // défaut: exonéré si NULL

    // 2️ (Suite) Récupérer les règles tarifaires matchant la catégorie du véhicule
    let vehicleCategory = "";
    if (resolvedVehicleId) {
      const { data: vehicleData } = await supabase
        .from("vehicles")
        .select("category")
        .eq("id", resolvedVehicleId)
        .maybeSingle();
      vehicleCategory = (vehicleData?.category ?? "").toLowerCase();
    }

    const { data: allPricingRules } = await supabase
      .from("pricing_rules")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .order("created_at", { ascending: false });

    const pricing = findPricingRule(allPricingRules ?? [], vehicleCategory);

    // 3️⃣ Calcul du prix
    let total = 0;
    let resolvedPricingMode: "manual" | "direct" = "manual";

    const manualAmount = manual_total ? Number(manual_total) : null;

    if (manualAmount && manualAmount > 0) {
      total = manualAmount;
      resolvedPricingMode = "manual";
    } else if (pricing) {
      total = calculatePrice({
        bookingType: booking_type === "hourly" ? "hourly" : "transfer",
        distanceKm: Number(distance_km || 0),
        durationHours: Number(duration_hours || 1),
        rule: pricing,
      });
      resolvedPricingMode = "direct";
    } else {
      return new Response(
        JSON.stringify({
          error: "Aucune règle tarifaire active et aucun montant manuel fourni.",
        }),
        { status: 400 },
      );
    }

    // Validation basique montant (évite les erreurs de saisie)
    if (total <= 0 || total > 9999) {
      return new Response(
        JSON.stringify({ error: `Montant invalide : ${total}€` }),
        { status: 400 },
      );
    }

    // 4️⃣ Calcul TVA (les prix de la grille sont TTC — TVA extraite)
    const { net, vat, gross } = computeVat(total, vatRate, isExempt);

    // 5️⃣ Insertion de la réservation
    const { data: booking, error: insertError } = await supabase
      .from("bookings")
      .insert({
        original_tenant_id: tenantId,
        current_tenant_id: tenantId,
        customer_id: customerId,
        pickup_address: pickup,
        dropoff_address: dropoff || pickup || "À définir",
        pickup_time,
        total_amount: gross,
        subtotal_amount: net,
        vat_amount: vat,
        status: "accepted",
        mission_status: "not_started",
        payment_mode: payment_mode || "cash",
        booking_source: "manual_driver",
        pricing_mode: resolvedPricingMode,
        booking_type: booking_type || "transfer",
        passenger_count: Number(passenger_count || 1),
        luggage_count: Number(luggage_count || 0),
        distance_km: distance_km ? Number(distance_km) : null,
        duration_hours: duration_hours ? Number(duration_hours) : null,
        driver_id: driverFull.id,
        vehicle_id: resolvedVehicleId,
      })
      .select()
      .limit(1)
      .maybeSingle();

    if (insertError) {
      console.error("Insert booking error:", insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
      });
    }

    if (!booking) {
      return new Response(
        JSON.stringify({
          error: "Erreur lors de la création de la réservation",
        }),
        {
          status: 500,
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        booking_id: booking.id,
        total_price: total,
      }),
      { status: 200 },
    );
  } catch (err: any) {
    console.error("Create booking crash:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
};
