-- activer RLS
alter table public.tenants enable row level security;
alter table public.pricing_rules enable row level security;

-- reset policies si elles existent
drop policy if exists "public_read_tenants" on public.tenants;
drop policy if exists "public_read_pricing" on public.pricing_rules;

-- permettre lecture publique pour le site
create policy "public_read_tenants"
on public.tenants
for select
using (true);

create policy "public_read_pricing"
on public.pricing_rules
for select
using (true);
