// src/pages/api/tenant/update-logo.ts
// Proxy vers la RPC owner update_tenant_logo (D-11 Phase 14) : garde owner et validation du
// chemin assets/logos/<tenant_id>/ en base.
import type { APIRoute } from "astro";
import { rpcErrorStatus } from "@/lib/rpc-error";

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

    const { data, error } = await locals.supabase.rpc("update_tenant_logo", { p_url: logo_url });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: rpcErrorStatus(error.code) });
    }

    return new Response(JSON.stringify({ success: true, logo_url: data }), { status: 200 });
  } catch (err: any) {
    console.error("[update-logo]", err);
    return new Response(JSON.stringify({ error: err.message ?? "Erreur serveur" }), { status: 500 });
  }
};
