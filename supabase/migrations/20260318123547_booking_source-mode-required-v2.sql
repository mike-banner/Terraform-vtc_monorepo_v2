create type booking_source_new as enum (
  'manual_driver',
  'customer'
);

alter table bookings
alter column booking_source drop default;

alter table bookings
alter column booking_source
type booking_source_new
using (
  case
    when booking_source = 'from_customer' then 'customer'::booking_source_new
    else booking_source::text::booking_source_new
  end
);

drop type booking_source;
alter type booking_source_new rename to booking_source;

alter table bookings
alter column booking_source set not null;
