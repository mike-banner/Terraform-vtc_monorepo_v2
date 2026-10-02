-- Jeu de données LOCAL (supabase db reset). Jamais appliqué en production.
-- Connexion backoffice : owner@local.test / local-test-1234
-- Tenant sans stripe_account_id : paiement direct avec la clé Stripe du .env.

insert into public.tenants (id, name, primary_domain, email, phone, site_slug, setup_completed, vat_rate)
values ('5750a0b3-4c6c-4782-b137-830a49e32249', 'Elite Lyon (local)', 'localhost', 'contact@local.test', '0400000000', 'elite-lyon', true, 10);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
) values (
  '00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
  'owner@local.test', crypt('local-test-1234', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', '', '', '', '', ''
);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'email',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"owner@local.test","email_verified":true}', now(), now(), now());

update public.profiles
set tenant_id = '5750a0b3-4c6c-4782-b137-830a49e32249', tenant_role = 'owner', first_name = 'Test', last_name = 'Owner'
where id = '11111111-1111-1111-1111-111111111111';

insert into public.drivers (id, tenant_id, first_name, last_name, phone, license_number, user_id)
values ('22222222-2222-2222-2222-222222222222', '5750a0b3-4c6c-4782-b137-830a49e32249', 'Test', 'Owner', '0600000000', 'LOCAL-001', '11111111-1111-1111-1111-111111111111');

insert into public.vehicles (tenant_id, driver_id, brand, model, plate_number, category, capacity, luggage_capacity, status)
values ('5750a0b3-4c6c-4782-b137-830a49e32249', '22222222-2222-2222-2222-222222222222', 'Mercedes', 'Classe E', 'AA-001-AA', 'berline', 4, 3, 'active');

insert into public.pricing_rules (tenant_id, base_price, price_per_km, minimum_fare, active, service_category, price_per_hour)
values ('5750a0b3-4c6c-4782-b137-830a49e32249', 10, 2, 30, true, 'berline', 60);

insert into public.zones (id, tenant_id, name, postal_codes) values
  ('33333333-3333-3333-3333-333333333331', '5750a0b3-4c6c-4782-b137-830a49e32249', 'Lyon centre',
    '{69001,69002,69003,69004,69005,69006,69007,69008,69009}'),
  ('33333333-3333-3333-3333-333333333332', '5750a0b3-4c6c-4782-b137-830a49e32249', 'Aéroport Saint-Exupéry', '{}');

insert into public.fixed_routes (tenant_id, pickup_zone_id, dropoff_zone_id, vehicle_category, price, is_bidirectional, active)
values ('5750a0b3-4c6c-4782-b137-830a49e32249', '33333333-3333-3333-3333-333333333331', '33333333-3333-3333-3333-333333333332', 'berline', 80, true, true);
