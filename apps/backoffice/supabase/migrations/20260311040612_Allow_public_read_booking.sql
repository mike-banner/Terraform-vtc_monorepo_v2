ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read booking by ID" ON public.bookings;
CREATE POLICY "Allow public read booking by ID"
ON public.bookings FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow public read customer by ID" ON public.customers;
CREATE POLICY "Allow public read customer by ID"
ON public.customers FOR SELECT TO anon USING (true);
