drop policy if exists "public read bookings" on bookings;
drop policy if exists "public read stripe_events" on stripe_events;
drop policy if exists "public read customers" on customers;

create policy "public read bookings"
on bookings
for select
using (true);

create policy "public read stripe_events"
on stripe_events
for select
using (true);

create policy "public read customers"
on customers
for select
using (true);
