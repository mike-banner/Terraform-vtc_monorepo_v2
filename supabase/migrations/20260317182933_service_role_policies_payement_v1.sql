-- =========================================================
-- V1 — SERVICE ROLE POLICIES SAFE
-- migration idempotente
-- =========================================================


-- =========================
-- CUSTOMERS
-- =========================

drop policy if exists service_role_full_access_customers
on public.customers;

create policy service_role_full_access_customers
on public.customers
for all
to service_role
using (true)
with check (true);



-- =========================
-- BOOKINGS
-- =========================

drop policy if exists service_role_full_access_bookings
on public.bookings;

create policy service_role_full_access_bookings
on public.bookings
for all
to service_role
using (true)
with check (true);



-- =========================
-- STRIPE EVENTS
-- =========================

drop policy if exists service_role_full_access_stripe_events
on public.stripe_events;

create policy service_role_full_access_stripe_events
on public.stripe_events
for all
to service_role
using (true)
with check (true);



-- =========================
-- VEHICLES
-- =========================

drop policy if exists service_role_full_access_vehicles
on public.vehicles;

create policy service_role_full_access_vehicles
on public.vehicles
for all
to service_role
using (true)
with check (true);



-- =========================
-- TENANTS
-- =========================

drop policy if exists service_role_full_access_tenants
on public.tenants;

create policy service_role_full_access_tenants
on public.tenants
for all
to service_role
using (true)
with check (true);



-- =========================
-- PROFILES
-- =========================

drop policy if exists service_role_full_access_profiles
on public.profiles;

create policy service_role_full_access_profiles
on public.profiles
for all
to service_role
using (true)
with check (true);
