-- Une plaque ne peut exister qu'une fois par tenant, sans tenir compte de la casse ni des séparateurs (AB-123-CD = ab123cd).
CREATE UNIQUE INDEX vehicles_tenant_plate_unique
  ON public.vehicles (tenant_id, upper(regexp_replace(plate_number, '[^A-Za-z0-9]', '', 'g')));
