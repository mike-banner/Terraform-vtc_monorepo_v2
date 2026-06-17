// src/pages/api/tenant/update-settings.ts
// Mise à jour des paramètres entreprise (TVA, forme juridique).
// Passe par le admin client pour contourner l'absence de policy RLS UPDATE sur tenants.
import type { APIRoute } from "astro";
import { createAdminClient } from "@/lib/supabase/server";

const EXEMPT_FORMS = ["auto_entrepreneur", "ei"];

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

    const isExempt = EXEMPT_FORMS.includes(legal_form);

    const supabase = createAdminClient(locals);

    const { error } = await supabase
      .from("tenants")
      .update({
        legal_form,
        vat_number: isExempt ? null : (vat_number?.trim() || null),
        is_vat_exempt: isExempt,
        vat_rate: isExempt ? 0 : 10,
      })
      .eq("id", profile.tenant_id);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    console.error("[update-settings]", err);
    return new Response(JSON.stringify({ error: err.message ?? "Erreur serveur" }), { status: 500 });
  }
};
