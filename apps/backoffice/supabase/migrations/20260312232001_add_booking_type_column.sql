ALTER TABLE public.bookings
ADD COLUMN booking_type booking_type_enum;

UPDATE public.bookings
SET booking_type = 'transfer'
WHERE booking_type IS NULL;

ALTER TABLE public.bookings
ALTER COLUMN booking_type SET NOT NULL;
