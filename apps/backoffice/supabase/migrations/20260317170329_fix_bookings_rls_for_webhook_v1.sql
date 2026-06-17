-- =========================================================
-- fix_bookings_rls_for_webhook_v1_1
-- Correction tenant_id → current_tenant_id
-- =========================================================


-- =========================
-- 1. Activer RLS
-- =========================

alter table bookings enable row level security;


-- =========================
-- 2. Supprimer anciennes policies
-- =========================

drop policy if exists "insert bookings" on bookings;
drop policy if exists "insert bookings anon" on bookings;
drop policy if exists "insert bookings authenticated" on bookings;

drop policy if exists "select bookings tenant" on bookings;
drop policy if exists "update bookings tenant" on bookings;
drop policy if exists "delete bookings tenant" on bookings;


-- =========================
-- 3. PAS de policy INSERT
-- webhook only
-- =========================


-- =========================
-- 4. SELECT tenant
-- =========================

create policy "select bookings tenant"
on bookings
for select
to authenticated
using (

  current_tenant_id = (
    select tenant_id
    from profiles
    where id = auth.uid()
  )

);


-- =========================
-- 5. UPDATE tenant (optionnel)
-- =========================

create policy "update bookings tenant"
on bookings
for update
to authenticated
using (

  current_tenant_id = (
    select tenant_id
    from profiles
    where id = auth.uid()
  )

)
with check (

  current_tenant_id = (
    select tenant_id
    from profiles
    where id = auth.uid()
  )

);


-- =========================
-- 6. DELETE bloqué
-- =========================

-- pas de policy delete


-- =========================
-- V1 RULE
-- booking créé uniquement par webhook
-- =========================
