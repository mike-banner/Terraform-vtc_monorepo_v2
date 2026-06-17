create or replace function public.approve_onboarding_tx(onboarding_uuid uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  new_tenant_id uuid := gen_random_uuid();
  new_driver_id uuid := gen_random_uuid();
begin

  -- 1️⃣ vérifier onboarding pending
  if not exists (
    select 1
    from onboarding
    where id = onboarding_uuid
      and status = 'pending'
  ) then
    raise exception 'Onboarding not found or already processed';
  end if;


  -- 2️⃣ créer tenant

  insert into tenants (
    id,
    name,
    primary_domain,
    email,
    phone
  )
  select
    new_tenant_id,
    o.company_name,
    o.primary_domain,
    u.email,
    o.phone
  from onboarding o
  join profiles p on p.id = o.profile_id
  join auth.users u on u.id = p.id
  where o.id = onboarding_uuid;


  -- 3️⃣ update profile owner

  update profiles p
  set
    tenant_id = new_tenant_id,
    tenant_role = 'owner',
    first_name = o.first_name,
    last_name = o.last_name
  from onboarding o
  where o.id = onboarding_uuid
    and p.id = o.profile_id;


  -- 4️⃣ créer driver #1

  insert into drivers (
    id,
    tenant_id,
    first_name,
    last_name,
    phone
  )
  select
    new_driver_id,
    new_tenant_id,
    o.first_name,
    o.last_name,
    o.phone
  from onboarding o
  where o.id = onboarding_uuid;


  -- 5️⃣ créer vehicle #1 (si données présentes)

  insert into vehicles (
    tenant_id,
    driver_id,
    brand,
    model,
    plate_number
  )
  select
    new_tenant_id,
    new_driver_id,
    o.vehicle_brand,
    o.vehicle_model,
    o.plate_number
  from onboarding o
  where o.id = onboarding_uuid
    and o.vehicle_brand is not null;


  -- 6️⃣ update onboarding

  update onboarding
  set
    status = 'approved',
    validated_at = now()
  where id = onboarding_uuid;

end;
$$;
