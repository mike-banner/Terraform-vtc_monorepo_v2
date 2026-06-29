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

  if not exists (
    select 1
    from onboarding
    where id = onboarding_uuid
      and status = 'pending'
  ) then
    raise exception 'Onboarding not found or already processed';
  end if;


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


  update profiles p
  set
    tenant_id = new_tenant_id,
    tenant_role = 'owner',
    first_name = o.first_name,
    last_name = o.last_name
  from onboarding o
  where o.id = onboarding_uuid
    and p.id = o.profile_id;


  insert into drivers (
    id,
    tenant_id,
    first_name,
    last_name,
    phone,
    license_number
  )
  select
    new_driver_id,
    new_tenant_id,
    o.first_name,
    o.last_name,
    o.phone,
    o.vtc_license_number
  from onboarding o
  where o.id = onboarding_uuid;


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


  update onboarding
  set
    status = 'approved',
    validated_at = now()
  where id = onboarding_uuid;

end;
$$;
