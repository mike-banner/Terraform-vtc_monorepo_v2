-- Bucket public « assets » : seul un owner ou un manager écrit, remplace ou supprime, et uniquement sous logos/<son tenant>/.
-- Avant : tout utilisateur authentifié pouvait supprimer n'importe quel objet et déposer n'importe où, et le remplacement échouait (pas de policy UPDATE).
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Owner Delete" ON storage.objects;

CREATE POLICY assets_tenant_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'assets'
  AND (storage.foldername(name))[1] = 'logos'
  AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  AND public.current_tenant_role() IN ('owner', 'manager')
);

CREATE POLICY assets_tenant_update ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'assets'
  AND (storage.foldername(name))[1] = 'logos'
  AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  AND public.current_tenant_role() IN ('owner', 'manager')
)
WITH CHECK (
  bucket_id = 'assets'
  AND (storage.foldername(name))[1] = 'logos'
  AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  AND public.current_tenant_role() IN ('owner', 'manager')
);

CREATE POLICY assets_tenant_delete ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'assets'
  AND (storage.foldername(name))[1] = 'logos'
  AND (storage.foldername(name))[2] = public.current_tenant_id()::text
  AND public.current_tenant_role() IN ('owner', 'manager')
);
