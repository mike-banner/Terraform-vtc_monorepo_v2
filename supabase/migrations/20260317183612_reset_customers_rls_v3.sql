/*
RESET COMPLET RLS customers
On supprime toutes les policies
Puis on recrée uniquement service_role
*/

alter table customers enable row level security;

-- remove ALL policies
drop policy if exists service_role_full_access_customers on customers;
drop policy if exists customers_select_policy on customers;
drop policy if exists customers_insert_policy on customers;
drop policy if exists customers_update_policy on customers;
drop policy if exists customers_delete_policy on customers;
drop policy if exists full_access on customers;
drop policy if exists allow_all on customers;

-- recreate clean policy

create policy service_role_full_access_customers
on customers
for all
to service_role
using (true)
with check (true);
