-- 20260629000001_invoices_bucket.sql
-- Bucket privé pour les PDFs de devis et factures.
-- RLS : chaque tenant ne voit que ses propres fichiers (préfixe {tenant_id}/).

INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "invoices_tenant_select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'invoices'
  AND (storage.foldername(name))[1] = (
    SELECT t.id::text FROM public.tenants t
    INNER JOIN public.profiles p ON p.tenant_id = t.id
    WHERE p.id = auth.uid()
    LIMIT 1
  )
);

CREATE POLICY "invoices_service_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'invoices');
