// src/pages/api/tenant/update-settings.ts
// Proxy vers la RPC owner update_tenant_settings (D-11 Phase 14) : TVA dérivée par trg_sync_tenant_vat.
import type { APIRoute } from "astro";
import { rpcErrorStatus } from "@/lib/rpc-error";

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { user, profile } = locals as any;
    if (!user || !profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { legal_form, vat_number } = await request.json();

    if (!legal_form) {
      return new Response(JSON.stringify({ error: "Paramètre manquant: legal_form" }), { status: 400 });
    }

    const { error } = await locals.supabase.rpc("update_tenant_settings", {
      p_legal_form: legal_form,
      p_vat_number: vat_number ?? undefined,
    });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: rpcErrorStatus(error.code) });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    console.error("[update-settings]", err);
    return new Response(JSON.stringify({ error: err.message ?? "Erreur serveur" }), { status: 500 });
  }
};
