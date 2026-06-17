alter table customers enable row level security;

drop policy if exists insert_customers_public on customers;

create policy insert_customers_public
on customers
for insert
to anon, authenticated
with check (
  tenant_id is not null
);

create policy insert_bookings_public
on bookings
for insert
to anon, authenticated
with check (
  original_tenant_id is not null
);
