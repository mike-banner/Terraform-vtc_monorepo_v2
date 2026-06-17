-- [MIGRATION] Add company_type to determine business structure (Auto-entrepreneur vs Société)

-- 1. Create the enum if not exists
DO $$ BEGIN
    CREATE TYPE public.company_type_enum AS ENUM ('auto_entrepreneur', 'societe');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add column to onboarding
ALTER TABLE public.onboarding
ADD COLUMN IF NOT EXISTS company_type public.company_type_enum DEFAULT 'societe';

-- 3. Add column to tenants
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS company_type public.company_type_enum DEFAULT 'societe';

-- 4. Update the approval function to carry over the company_type
CREATE OR REPLACE FUNCTION public.approve_onboarding_tx(onboarding_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id uuid := gen_random_uuid();
  o record;
  u_id uuid;
BEGIN

  -- Vérifier que le dossier existe et est pending
  SELECT * INTO o FROM onboarding WHERE id = onboarding_uuid AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onboarding not found or already processed';
  END IF;

  -- Récupérer l'user_id lié au profile
  SELECT id INTO u_id FROM profiles WHERE id = o.profile_id;

  -- 1️⃣ Créer le TENANT avec les données pro (Flash) + company_type
  INSERT INTO tenants (
    id, name, primary_domain, email, phone, siret, company_type, setup_completed
  )
  SELECT
    new_tenant_id, o.company_name, o.primary_domain, u.email, o.phone, o.siret, o.company_type, false
  FROM auth.users u WHERE u.id = u_id;

  -- 2️⃣ Mettre à jour le PROFILE (devient owner du tenant)
  UPDATE profiles
  SET
    tenant_id = new_tenant_id,
    tenant_role = 'owner',
    first_name = o.first_name,
    last_name = o.last_name
  WHERE id = u_id;

  -- 3️⃣ Marquer onboarding validé
  UPDATE onboarding
  SET
    status = 'approved',
    validated_at = now()
  WHERE id = onboarding_uuid;

END;
$$;
