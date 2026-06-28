import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'npm:stripe';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  try {
    const { tenant_id, email } = await req.json();

    if (!tenant_id) {
      throw new Error('tenant_id required');
    }

    // ✅ create connect account

    const account = await stripe.accounts.create({
      type: 'express',
      country: 'FR',
      email,
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
    });

    // ✅ save in tenants

    const { error } = await supabase
      .from('tenants')
      .update({
        stripe_account_id: account.id,
      })
      .eq('id', tenant_id);

    if (error) {
      throw new Error('DB update failed');
    }

    return new Response(
      JSON.stringify({
        account_id: account.id,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error }), { status: 500 });
  }
});
