-- =========================
-- BOOKING VEHICLE
-- =========================

alter table bookings
add column vehicle_id uuid;

alter table bookings
add constraint bookings_vehicle_fk
foreign key (vehicle_id)
references vehicles(id)
on delete set null;

create index bookings_vehicle_id_idx
on bookings(vehicle_id);


-- =========================
-- VEHICLE LUGGAGE
-- =========================

alter table vehicles
add column luggage_capacity int not null default 3;

update vehicles
set luggage_capacity = 8
where category = 'van';

update vehicles
set luggage_capacity = 3
where category = 'berline';
