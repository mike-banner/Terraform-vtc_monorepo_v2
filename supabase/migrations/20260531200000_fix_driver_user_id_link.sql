-- Backfill : lier les drivers orphelins (user_id IS NULL) à leur owner
-- Condition : un seul owner par tenant, un seul driver sans user_id par tenant
UPDATE public.drivers d
SET user_id = p.id
FROM public.profiles p
WHERE p.tenant_id = d.tenant_id
  AND p.tenant_role = 'owner'
  AND d.user_id IS NULL;

-- Mise à jour de approve_onboarding_tx pour inclure user_id dès la création
CREATE OR REPLACE FUNCTION public.approve_onboarding_tx(onboarding_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$

DECLARE
  new_tenant_id uuid := gen_random_uuid();
  new_driver_id uuid := gen_random_uuid();
  owner_profile_id uuid;

BEGIN

  IF NOT EXISTS (
    SELECT 1 FROM onboarding
    WHERE id = onboarding_uuid AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Onboarding not found or already processed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM profiles p
    JOIN onboarding o ON o.profile_id = p.id
    WHERE o.id = onboarding_uuid AND p.tenant_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Tenant already created for this profile';
  END IF;

  SELECT o.profile_id INTO owner_profile_id
  FROM onboarding o WHERE o.id = onboarding_uuid;

  -- Créer le tenant
  INSERT INTO tenants (id, name, primary_domain, email, phone)
  SELECT new_tenant_id, o.company_name, o.primary_domain, u.email, o.phone
  FROM onboarding o
  JOIN profiles p ON p.id = o.profile_id
  JOIN auth.users u ON u.id = p.id
  WHERE o.id = onboarding_uuid;

  -- Mettre à jour le profil owner
  UPDATE profiles p
  SET
    tenant_id   = new_tenant_id,
    tenant_role = 'owner',
    first_name  = o.first_name,
    last_name   = o.last_name
  FROM onboarding o
  WHERE o.id = onboarding_uuid AND p.id = o.profile_id;

  -- Créer le driver titulaire avec user_id lié
  INSERT INTO drivers (id, tenant_id, user_id, first_name, last_name, phone, license_number)
  SELECT new_driver_id, new_tenant_id, owner_profile_id,
         o.first_name, o.last_name, o.phone, o.vtc_license_number
  FROM onboarding o
  WHERE o.id = onboarding_uuid;

  -- Créer le véhicule si présent
  INSERT INTO vehicles (tenant_id, driver_id, brand, model, plate_number)
  SELECT new_tenant_id, new_driver_id, o.vehicle_brand, o.vehicle_model, o.plate_number
  FROM onboarding o
  WHERE o.id = onboarding_uuid AND o.vehicle_brand IS NOT NULL;

  -- Marquer onboarding approuvé
  UPDATE onboarding SET status = 'approved', validated_at = now()
  WHERE id = onboarding_uuid;

END;
$function$;
