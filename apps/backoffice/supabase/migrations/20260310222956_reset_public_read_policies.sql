-- supprimer ancienne policy si elle existe
drop policy if exists "public_read_tenants" on public.tenants;

-- s'assurer que RLS est actif
alter table public.tenants enable row level security;

-- nouvelle policy propre
create policy "public_read_tenants"
on public.tenants
for select
using (true);


drop policy if exists "public_read_pricing" on public.pricing_rules;

alter table public.pricing_rules enable row level security;

create policy "public_read_pricing"
on public.pricing_rules
for select
using (true);
