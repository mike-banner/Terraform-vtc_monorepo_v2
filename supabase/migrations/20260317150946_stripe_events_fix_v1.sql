-- =====================================================
-- STRIPE EVENTS LOG TABLE
-- Used to track all Stripe activity:
-- checkout sessions
-- payments
-- webhooks
-- refunds
-- transfers
-- errors
-- This table must stay generic
-- =====================================================

drop table if exists stripe_events cascade;

create table stripe_events (

  -- Primary key
  id uuid primary key default gen_random_uuid(),

  -- Stripe identifiers
  stripe_event_id text,        -- Stripe event id (evt_...)
  session_id text,             -- checkout session id (cs_...)
  payment_intent_id text,      -- payment intent (pi_...)

  -- Event info
  event_type text,             -- checkout_session_created / payment_succeeded / webhook / etc
  status text,                 -- session_created / completed / failed / expired / error

  -- Context
  tenant_id uuid,              -- tenant linked to payment
  booking_id uuid,             -- booking created after payment

  -- Service info
  booking_type text,           -- transfer / hourly / share / manual / dispatch

  -- Money
  amount numeric,              -- total amount

  -- Full metadata snapshot (from stripe / session / webhook)
  metadata jsonb,

  -- Error message if failure
  error text,

  -- Timestamp
  created_at timestamptz default now()

);

-- =====================================================
-- INDEXES
-- =====================================================

-- fast lookup by session
create index idx_stripe_events_session
on stripe_events (session_id);

-- fast lookup by payment intent
create index idx_stripe_events_payment
on stripe_events (payment_intent_id);

-- fast lookup by tenant
create index idx_stripe_events_tenant
on stripe_events (tenant_id);

-- fast lookup by type
create index idx_stripe_events_type
on stripe_events (event_type);
