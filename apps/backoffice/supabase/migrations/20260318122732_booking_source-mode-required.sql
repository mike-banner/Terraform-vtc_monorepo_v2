-- 1. ENUM booking_source
do $$ begin
  create type booking_source as enum (
    'manual_driver',
    'from_customer'
  );
exception
  when duplicate_object then null;
end $$;

-- 2. ENUM pricing_mode
do $$ begin
  create type pricing_mode as enum (
    'direct',
    'manual'
  );
exception
  when duplicate_object then null;
end $$;

-- 3. Ajouter colonnes
alter table bookings
add column if not exists booking_source booking_source,
add column if not exists pricing_mode pricing_mode,
add column if not exists approval_required boolean default false;

-- 4. Backfill pour tes données existantes
update bookings
set
  booking_source = 'from_customer',
  pricing_mode = 'direct',
  approval_required = false
where booking_source is null;

-- 5. Contraintes (important pour solidité)
alter table bookings
alter column booking_source set not null,
alter column pricing_mode set not null,
alter column approval_required set not null;
