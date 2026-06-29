ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS price_per_hour numeric NOT NULL DEFAULT 0;
