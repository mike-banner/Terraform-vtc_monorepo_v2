alter table stripe_events enable row level security;
alter table bookings enable row level security;
alter table customers enable row level security;


drop policy if exists "public_read_stripe_events" on stripe_events;
drop policy if exists "public_read_bookings" on bookings;
drop policy if exists "public_read_customers" on customers;

create policy "public_read_stripe_events"
on stripe_events
for select
to anon
using (true);

create policy "public_read_bookings"
on bookings
for select
to anon
using (true);

create policy "public_read_customers"
on customers
for select
to anon
using (true);
