-- [PROJET MIGRATION] Mike-Standard Onboarding v4 (Clean Fix)

-- 1. Supprimer la vue dépendante pour permettre la modification de la table
DROP VIEW IF EXISTS public.onboarding_admin_view;

-- 2. Nettoyage de la table de transit (Désencombrement)
ALTER TABLE public.onboarding
DROP COLUMN IF EXISTS capacity,
DROP COLUMN IF EXISTS default_base_price,
DROP COLUMN IF EXISTS default_price_per_km,
DROP COLUMN IF EXISTS default_minimum_fare,
DROP COLUMN IF EXISTS service_categories,
DROP COLUMN IF EXISTS vehicle_brand,
DROP COLUMN IF EXISTS vehicle_model,
DROP COLUMN IF EXISTS plate_number;

-- 3. Ajout des nouveaux champs pro (Onboarding)
ALTER TABLE public.onboarding
ADD COLUMN IF NOT EXISTS siret text;

-- 4. Recréation de la vue Admin (Version Allégée)
CREATE OR REPLACE VIEW "public"."onboarding_admin_view" AS
 SELECT "o"."id",
    "o"."profile_id",
    "o"."status",
    "o"."company_name",
    "o"."primary_domain",
    "o"."phone",
    "o"."siret",
    "o"."created_at",
    "o"."validated_at",
    "o"."vtc_license_number",
    "o"."first_name",
    "o"."last_name",
    "u"."email" AS "auth_email"
   FROM ("public"."onboarding" "o"
     JOIN "auth"."users" "u" ON (("o"."profile_id" = "u"."id")));

ALTER VIEW "public"."onboarding_admin_view" OWNER TO "postgres";

-- 5. Ajout des champs légaux et flag Setup (Tenants)
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS siret text,
ADD COLUMN IF NOT EXISTS siren text,
ADD COLUMN IF NOT EXISTS setup_completed boolean DEFAULT false;

-- 6. Mise à jour de la fonction de migration (Onboarding -> Production)
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

  -- 1️⃣ Créer le TENANT avec les données pro (Flash) + setup_completed = false
  INSERT INTO tenants (
    id, name, primary_domain, email, phone, siret, setup_completed
  )
  SELECT
    new_tenant_id, o.company_name, o.primary_domain, u.email, o.phone, o.siret, false
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
