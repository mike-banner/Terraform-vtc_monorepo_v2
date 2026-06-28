-- Pour la table customers
CREATE TABLE IF NOT EXISTS public.customers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL,
    email text NOT NULL,
    first_name text,
    last_name text,
    phone text,
    created_at timestamptz DEFAULT now(),
    UNIQUE(tenant_id, email)
);

-- Pour la liaison (C'est ici que ça bloquait)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='customer_id') THEN
        ALTER TABLE public.bookings ADD COLUMN customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
    END IF;
END $$;
