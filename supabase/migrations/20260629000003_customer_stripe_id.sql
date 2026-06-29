-- 20260629000003_customer_stripe_id.sql
-- Stripe Customer ID pour les clients finaux (passagers).
-- Renseigné à la première génération de facture Stripe (on-the-fly dans generate-invoice).

ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS stripe_customer_id text;

CREATE UNIQUE INDEX IF NOT EXISTS customers_stripe_customer_id_key
ON public.customers (stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;
