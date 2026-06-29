-- Restreindre la création de chauffeurs aux owners du tenant.
-- La policy existante (drivers_tenant_isolation) couvre SELECT/UPDATE/DELETE.
-- On ajoute une policy INSERT dédiée qui vérifie en plus le tenant_role = 'owner'.

CREATE POLICY "drivers_insert_owner_only"
  ON "public"."drivers"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.tenant_role = 'owner'
    )
  );
