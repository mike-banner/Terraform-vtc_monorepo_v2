-- 20260629000004_invoice_sequences.sql
-- Compteur séquentiel de numéros de facture par tenant + année.
-- Obligatoire : art. L441-3 Code de Commerce (numérotation sans rupture ni réutilisation).

CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  year      int  NOT NULL,
  last_seq  int  NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, year)
);

-- Fonction thread-safe : INSERT ... ON CONFLICT DO UPDATE garantit l'atomicité
-- même sous charge concurrente (pas de gap possible).
CREATE OR REPLACE FUNCTION public.next_invoice_number(t_id uuid, y int)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seq int;
BEGIN
  INSERT INTO invoice_sequences (tenant_id, year, last_seq)
  VALUES (t_id, y, 1)
  ON CONFLICT (tenant_id, year)
  DO UPDATE SET last_seq = invoice_sequences.last_seq + 1
  RETURNING last_seq INTO seq;

  RETURN format('FAC-%s-%s', y, lpad(seq::text, 4, '0'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid, int) TO authenticated;
