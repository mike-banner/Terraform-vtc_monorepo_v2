import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.18.0?target=deno&no-check';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
}) as any;

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
    },
  },
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    console.log('BODY =', body);

    const customer_data = body.customer_data;
    const booking_data = body.booking_data;

    if (!booking_data) throw new Error('booking_data missing');
    if (!booking_data.type) throw new Error('booking_type missing');
    if (!booking_data.tenant_id) throw new Error('tenant_id missing');

    const tenantId = booking_data.tenant_id;

    // =========================
    // CUSTOMER UPSERT
    // =========================

    console.log('UPSERT CUSTOMER INPUT', {
      tenantId,
      email: customer_data?.email,
    });

    const { data: customer, error: cErr } = await supabaseAdmin
      .from('customers')
      .upsert(
        {
          tenant_id: tenantId,
          email: customer_data.email,
          first_name: customer_data.first_name,
          last_name: customer_data.last_name,
          phone: customer_data.phone,
        },
        {
          onConflict: 'tenant_id,email',
        },
      )
      .select()
      .single();

    if (cErr) {
      console.log('CUSTOMERS ERROR =', cErr);
      throw new Error(cErr.message);
    }

    if (!customer) {
      console.log('CUSTOMER NULL');
      throw new Error('customer null');
    }

    // =========================
    // VEHICLE CHECK
    // =========================

    const vehicleId = booking_data.vehicle_id;

    if (!vehicleId) {
      throw new Error('vehicle_id required');
    }

    const { data: vehicle, error: vErr } = await supabaseAdmin
      .from('vehicles')
      .select('tenant_id,status,category')
      .eq('id', vehicleId)
      .single();

    if (vErr) {
      console.log('VEHICLE ERROR =', vErr);
      throw new Error(vErr.message);
    }

    if (!vehicle) throw new Error('vehicle not found');

    if (vehicle.status !== 'active') {
      throw new Error('vehicle inactive');
    }

    if (vehicle.tenant_id !== tenantId) {
      throw new Error('vehicle tenant mismatch');
    }

    // =========================
    // TENANT
    // =========================

    const { data: tenant, error: tErr } = await supabaseAdmin
      .from('tenants')
      .select('stripe_account_id, platform_fee_rate')
      .eq('id', tenantId)
      .single();

    if (tErr) {
      console.log('TENANT ERROR =', tErr);
      throw new Error(tErr.message);
    }

    if (!tenant) throw new Error('tenant not found');

    if (!tenant.stripe_account_id) {
      throw new Error('stripe not connected');
    }

    const account = await stripe.accounts.retrieve(tenant.stripe_account_id);

    if (!account.charges_enabled) {
      throw new Error('stripe not ready');
    }

    // =========================
    // PRICE CALCULATION
    // =========================

    let calculatedTotal = 0;
    const fixedRouteId = booking_data.fixed_route_id;

    if (fixedRouteId) {
      const { data: route, error: rErr } = await supabaseAdmin
        .from('fixed_routes')
        .select('price, tenant_id, active')
        .eq('id', fixedRouteId)
        .single();

      if (rErr || !route) {
        throw new Error('Fixed route not found');
      }
      if (!route.active) {
        throw new Error('Fixed route is inactive');
      }
      if (route.tenant_id !== tenantId) {
        throw new Error('Fixed route tenant mismatch');
      }
      calculatedTotal = Number(route.price);
    } else {
      const { data: allPricingRules, error: prErr } = await supabaseAdmin
        .from('pricing_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('active', true);

      if (prErr || !allPricingRules || allPricingRules.length === 0) {
        throw new Error('No pricing rules found for tenant');
      }

      const cat = (vehicle.category ?? "").toLowerCase().trim();
      const rule = allPricingRules.find((r: any) => (r.service_category ?? "").toLowerCase().trim() === cat) || allPricingRules[0];

      const base = Number(rule.base_price) || 0;
      const minFare = Number(rule.minimum_fare) || 0;
      const type = booking_data.type;

      if (type === 'hourly') {
        const durationHours = Number(booking_data.duration_hours || 1);
        calculatedTotal = base + (Number(rule.price_per_hour) || 0) * durationHours;
      } else {
        const distanceKm = Number(booking_data.distance_km || 0);
        calculatedTotal = base + (Number(rule.price_per_km) || 0) * distanceKm;
      }

      calculatedTotal = Math.max(calculatedTotal, minFare);
    }

    const safeTotal = calculatedTotal > 0 ? calculatedTotal : 1;

    console.log('CALCULATED TOTAL =', calculatedTotal);
    console.log('SAFE TOTAL =', safeTotal);

    // =========================
    // STRIPE SESSION
    // =========================

    const amountInCents = Math.round(safeTotal * 100);

    const feeRate = tenant.platform_fee_rate ?? 0;

    const feeInCents = Math.round((feeRate / 100) * amountInCents);

    const origin = req.headers.get('origin') || req.headers.get('referer') || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',

      customer_email: customer.email,

      metadata: {
        tenant_id: tenantId,
        booking_type: booking_data.type,
        pickup_address: booking_data.pickup_address,
        dropoff_address: booking_data.dropoff_address || "",
        pickup_time: booking_data.pickup_time,
        vehicle_id: booking_data.vehicle_id,
        total_amount: String(safeTotal),
        customer_id: customer.id,
        distance_km: String(booking_data.distance_km || "0"),
        duration_hours: String(booking_data.duration_hours || "0"),
        fixed_route_id: booking_data.fixed_route_id || "",
        passenger_count: String(booking_data.passenger_count || "1"),
        luggage_count: String(booking_data.luggage_count || "0"),
      },

      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Course VTC',
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],

      payment_intent_data: {
        application_fee_amount: feeInCents > 0 ? feeInCents : undefined,

        transfer_data: {
          destination: tenant.stripe_account_id,
        },

        on_behalf_of: tenant.stripe_account_id,
      },

      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/transfert`,
    });

    await supabaseAdmin.from('stripe_events').insert({
      session_id: session.id,
      status: 'checkout_created',
      tenant_id: tenantId,
      booking_type: booking_data.type,
      amount: safeTotal,
      metadata: {
        customer_id: customer.id,
        vehicle_id: booking_data.vehicle_id,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    console.log('FINAL ERROR =', err);
    const error = err instanceof Error ? err.message : String(err);

    return new Response(JSON.stringify({ error }), {
      headers: corsHeaders,
      status: 400,
    });
  }
});
