-- 20260927120000_approve_onboarding_platform_guard.sql
--
-- Rend approve_onboarding_tx appelable depuis apps/superadmin.
--
-- L'écran d'approbation du backoffice (/admin/onboardings) est inaccessible : le middleware
-- renvoie tout admin plateforme vers l'accueil, et superadmin n'avait pas d'écran
-- équivalent. Aucun onboarding n'était donc approuvable par un humain. superadmin est une
-- SPA qui parle à Supabase avec le JWT de l'admin : elle ne peut pas appeler une fonction
-- réservée à service_role.
--
-- L'autorisation passe donc dans la fonction elle-même, sur le modèle du Kill Switch
-- (policy tenants_platform_admin_write) : service_role, ou un profil portant un
-- platform_role. platform_role ne peut pas être auto-attribué (trigger de
-- 20260921000000_security_hardening.sql), c'est ce qui rend ce contrôle fiable.
--
-- Corps inchangé par ailleurs depuis 20260926003805.

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

  -- auth.uid() / auth.jwt() lisent le JWT de l'appelant, même en SECURITY DEFINER.
  IF coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM profiles
       WHERE id = auth.uid()
         AND platform_role IN ('super_admin', 'platform_staff')
     ) THEN
    RAISE EXCEPTION 'approve_onboarding_tx: réservé aux administrateurs plateforme'
      USING ERRCODE = '42501';
  END IF;

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

  -- Créer le tenant. Les champs légaux viennent du dossier d'onboarding ;
  -- trg_set_tenant_vat_on_insert en déduit is_vat_exempt et vat_rate.
  -- setup_completed reste false : app/setup.astro le passe à true en créant le
  -- véhicule et la grille tarifaire.
  INSERT INTO tenants (
    id, name, primary_domain, email, phone,
    siret, legal_form, company_type, setup_completed
  )
  SELECT
    new_tenant_id, o.company_name, o.primary_domain, u.email, o.phone,
    o.siret,
    o.legal_form,
    CASE
      WHEN o.legal_form IN ('auto_entrepreneur', 'ei') THEN 'auto_entrepreneur'::company_type_enum
      ELSE 'societe'::company_type_enum
    END,
    false
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

  -- Créer le driver titulaire, lié au compte de l'owner (exploitation solo)
  INSERT INTO drivers (id, tenant_id, user_id, first_name, last_name, phone, license_number)
  SELECT new_driver_id, new_tenant_id, owner_profile_id,
         o.first_name, o.last_name, o.phone, o.vtc_license_number
  FROM onboarding o
  WHERE o.id = onboarding_uuid;

  -- Marquer onboarding approuvé
  UPDATE onboarding SET status = 'approved', validated_at = now()
  WHERE id = onboarding_uuid;

END;
$function$;

-- anon reste exclu (PUBLIC visé, cf. 20260925090000) ; authenticated est admis, le
-- contrôle de rôle ci-dessus fait le tri.
REVOKE EXECUTE ON FUNCTION public.approve_onboarding_tx(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_onboarding_tx(uuid) TO authenticated, service_role;
