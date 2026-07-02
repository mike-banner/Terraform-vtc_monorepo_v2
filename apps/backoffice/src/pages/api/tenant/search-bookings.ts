// src/pages/api/tenant/search-bookings.ts
import { createServerClient } from '@vtc/database';
import { parseCookieHeader } from '@supabase/ssr';
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const { user, profile } = locals as any;

    // 🛡️ Securité de base : Authentification requise
    if (!user || !profile) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    const rawQ = new URL(request.url).searchParams.get("q") ?? "";
    // 🛡️ Sanitize : neutralise les métacaractères de filtre PostgREST avant interpolation
    const q = rawQ.trim().slice(0, 100).replace(/[,()%*\\]/g, " ").trim();

    if (q.length < 2) {
      return new Response(JSON.stringify([]), { status: 200 });
    }

    const supabase = createServerClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll: () =>
            parseCookieHeader(request.headers.get("Cookie") ?? "").map((c) => ({
              name: c.name,
              value: c.value ?? "",
            })),
          setAll: (cookiesToSet) =>
            cookiesToSet.forEach(({ name, value, options }) =>
              cookies.set(name, value, options),
            ),
        },
      },
    );

    // 🎯 Filtrage par Tenant (Isolation multi-entreprise)
    let query = supabase
      .from("bookings")
      .select("*, customers(*)")
      .eq("current_tenant_id", profile.tenant_id);

    // 👮 PERMISSIONS FINES :
    // - owner / manager -> voient toutes les bookings du tenant
    // - driver -> voit uniquement ses bookings
    if (profile.tenant_role === "driver") {
      const { data: driver } = await supabase
        .from("drivers")
        .select("id")
        .eq("user_id", user.id)
        .eq("tenant_id", profile.tenant_id!)
        .limit(1)
        .maybeSingle();

      if (driver) {
        query = query.eq("driver_id", driver.id);
      } else {
        // Si pas de profil chauffeur trouvé, on ne retourne rien (sécurité)
        return new Response(JSON.stringify([]), { status: 200 });
      }
    }

    // 🔎 Pré-lookup client (nom/téléphone) — .or() ne traverse pas la relation embarquée customers
    const { data: custs } = await supabase
      .from("customers")
      .select("id")
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`);

    const ids = (custs ?? []).map((c) => c.id);

    // "Référence course" = bookings.invoice_number (pas de colonne référence dédiée)
    if (ids.length) {
      query = query.or(`customer_id.in.(${ids.join(",")}),invoice_number.ilike.%${q}%`);
    } else {
      query = query.ilike("invoice_number", `%${q}%`);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Search bookings error:", error);
      throw error;
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
};
