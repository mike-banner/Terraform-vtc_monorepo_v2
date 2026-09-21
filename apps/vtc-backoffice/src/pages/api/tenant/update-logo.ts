// src/pages/api/tenant/update-logo.ts
// Enregistre l'URL du logo du tenant.
// Passe par le admin client : il n'existe pas de policy RLS UPDATE sur `tenants`
// pour les utilisateurs tenant (l'UPDATE direct depuis le navigateur échouait
// silencieusement, l'UI annonçait "Logo mis à jour" sans effet).
import type { APIRoute } from "astro";
import { createAdminClient } from "@/lib/supabase/server";

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { user, profile } = locals as any;
    if (!user || !profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { logo_url } = await request.json();

    if (typeof logo_url !== "string" || !logo_url.trim()) {
      return new Response(JSON.stringify({ error: "Paramètre manquant: logo_url" }), { status: 400 });
    }

    // N'accepter qu'une URL du bucket public `assets` du projet Supabase :
    // évite d'enregistrer une URL arbitraire (phishing / pointage externe).
    const publicBucketPrefix = `${import.meta.env.PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets/`;
    if (!logo_url.startsWith(publicBucketPrefix)) {
      return new Response(JSON.stringify({ error: "URL de logo invalide" }), { status: 400 });
    }

    const supabase = createAdminClient(locals);

    const { error } = await supabase
      .from("tenants")
      .update({ logo_url: logo_url.trim() })
      .eq("id", profile.tenant_id);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, logo_url: logo_url.trim() }), { status: 200 });
  } catch (err: any) {
    console.error("[update-logo]", err);
    return new Response(JSON.stringify({ error: err.message ?? "Erreur serveur" }), { status: 500 });
  }
};
