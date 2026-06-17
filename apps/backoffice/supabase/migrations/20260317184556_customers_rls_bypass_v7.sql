/*
FINAL FIX customers RLS

Allow service_role to bypass tenant isolation
*/

alter table customers enable row level security;


-- remove tenant isolation

drop policy if exists customers_tenant_isolation on customers;


-- keep service_role full access

drop policy if exists customers_service_role_all on customers;

create policy customers_service_role_all
on customers
for all
to service_role
using (true)
with check (true);


-- tenant isolation ONLY for authenticated

create policy customers_tenant_isolation_auth
on customers
for all
to authenticated
using (
  tenant_id = current_tenant_id()
)
with check (
  tenant_id = current_tenant_id()
);
