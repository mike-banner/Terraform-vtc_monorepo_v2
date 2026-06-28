create or replace function public.get_available_vehicles(
  p_tenant_id uuid
)
returns table (
  id uuid,
  category vehicle_category_enum,
  capacity int,
  brand text,
  model text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id,
    v.category,
    v.capacity,
    v.brand,
    v.model
  from public.vehicles v
  where v.tenant_id = p_tenant_id
  and v.status = 'active'
$$;
