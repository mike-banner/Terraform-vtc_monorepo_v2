// supabase/functions/create-stripe-onboarding/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { tenant_id } = await req.json();

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, email, stripe_account_id")
      .eq("id", tenant_id)
      .limit(1)
      .maybeSingle();

    if (!tenant) {
      throw new Error("Tenant not found");
    }

    let accountId = tenant.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "FR",
        email: tenant.email,
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
      });

      accountId = account.id;

      await supabase
        .from("tenants")
        .update({ stripe_account_id: accountId })
        .eq("id", tenant.id);
    }

    const account = await stripe.accounts.retrieve(accountId);

    if (!account.charges_enabled) {
      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: "https://example.com/refresh",
        return_url: "https://example.com/return",
        type: "account_onboarding",
      });

      return new Response(
        JSON.stringify({
          type: "onboarding",
          url: link.url,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    const login = await stripe.accounts.createLoginLink(accountId);

    return new Response(
      JSON.stringify({
        type: "dashboard",
        url: login.url,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
