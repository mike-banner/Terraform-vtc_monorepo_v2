/*
-------------------------------------------------------
FIX RLS V2 — allow service_role full access
Used by Stripe webhook / Edge Functions
-------------------------------------------------------

Problem:
Webhook uses service_role key
RLS blocks inserts if policy not defined for service_role

Solution:
Create full access policies for service_role
on customers / bookings / stripe_events
-------------------------------------------------------
*/


/* =====================================================
   CUSTOMERS
===================================================== */

-- Enable RLS
alter table customers enable row level security;

-- Remove old policy if exists
drop policy if exists service_role_full_access_customers
on customers;

-- Allow service_role full access
create policy service_role_full_access_customers
on customers
for all
to service_role
using (true)
with check (true);



/* =====================================================
   BOOKINGS
===================================================== */

alter table bookings enable row level security;

drop policy if exists service_role_full_access_bookings
on bookings;

create policy service_role_full_access_bookings
on bookings
for all
to service_role
using (true)
with check (true);



/* =====================================================
   STRIPE EVENTS
===================================================== */

alter table stripe_events enable row level security;

drop policy if exists service_role_full_access_stripe_events
on stripe_events;

create policy service_role_full_access_stripe_events
on stripe_events
for all
to service_role
using (true)
with check (true);



/* =====================================================
   DEBUG CHECK (optional)
   You can run manually in SQL editor
===================================================== */

-- select *
-- from pg_policies
-- where tablename in (
--   'customers',
--   'bookings',
--   'stripe_events'
-- );
