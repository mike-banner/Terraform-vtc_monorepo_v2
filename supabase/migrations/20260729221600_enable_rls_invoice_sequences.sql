-- Migration : 20260729221600_enable_rls_invoice_sequences.sql
-- Fix Supabase Security Advisor alert: rls_disabled_in_public
-- Enable Row Level Security (RLS) on public.invoice_sequences

ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;

-- Restreindre les accès directs par API REST
REVOKE ALL ON TABLE public.invoice_sequences FROM anon, authenticated, public;
GRANT ALL ON TABLE public.invoice_sequences TO service_role;

-- Politique d'isolation par tenant pour les accès authentifiés
CREATE POLICY "Tenant owners read invoice_sequences"
  ON public.invoice_sequences
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );
