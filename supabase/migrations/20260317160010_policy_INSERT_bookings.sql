drop policy if exists "insert bookings" on bookings;

create policy "insert bookings"
on bookings
for insert
to anon, authenticated
with check (true);
