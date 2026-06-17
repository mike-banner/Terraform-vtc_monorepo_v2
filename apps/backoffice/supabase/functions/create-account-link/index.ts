import Stripe from 'npm:stripe';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});

Deno.serve(async (req) => {
  try {
    const { account_id } = await req.json();

    const link = await stripe.accountLinks.create({
      account: account_id,
      refresh_url: 'http://localhost:3000/stripe/refresh',
      return_url: 'http://localhost:3000/stripe/return',
      type: 'account_onboarding',
    });

    return new Response(JSON.stringify({ url: link.url }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error }), { status: 500 });
  }
});
