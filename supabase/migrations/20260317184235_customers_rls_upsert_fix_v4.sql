/*
customers RLS fix for UPSERT
Allow service_role full access
Fix tenant isolation conflict
*/

alter table customers enable row level security;


-- remove old policies

drop policy if exists service_role_full_access_customers on customers;
drop policy if exists customers_insert on customers;
drop policy if exists customers_update on customers;
drop policy if exists customers_select on customers;
drop policy if exists customers_all on customers;
drop policy if exists customers_tenant_isolation on customers;
drop policy if exists customers_platform_admin_read on customers;
drop policy if exists "Allow public read customer by ID" on customers;


-- service_role full access

create policy customers_service_role_all
on customers
for all
to service_role
using (true)
with check (true);


-- tenant isolation only for authenticated users

create policy customers_tenant_isolation
on customers
for all
to authenticated
using (
  tenant_id = current_tenant_id()
)
with check (
  tenant_id = current_tenant_id()
);
