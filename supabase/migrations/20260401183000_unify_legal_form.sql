-- [MIGRATION] Clean-up & Unify Legal Form (Lowercase)

-- 1. On renomme les valeurs de l'ENUM legal_form_enum en minuscules
-- Note: Si la migration est relancée et que les valeurs sont déjà en minuscules, cela pourrait lever une erreur.
-- Pour une exécution pure, on suit le snippet fourni par l'utilisateur.
ALTER TYPE legal_form_enum RENAME VALUE 'AUTO_ENTREPRENEUR' TO 'auto_entrepreneur';
ALTER TYPE legal_form_enum RENAME VALUE 'SASU' TO 'sasu';
ALTER TYPE legal_form_enum RENAME VALUE 'EURL' TO 'eurl';
ALTER TYPE legal_form_enum RENAME VALUE 'SARL' TO 'sarl';
ALTER TYPE legal_form_enum RENAME VALUE 'SAS' TO 'sas';
ALTER TYPE legal_form_enum RENAME VALUE 'EI' TO 'ei';
ALTER TYPE legal_form_enum RENAME VALUE 'OTHER' TO 'other';

-- 2. On corrige la data foireuse dans la table tenants
UPDATE tenants
SET
    legal_form = lower(legal_form::text)::legal_form_enum,
    -- Correction critique : si c'est un AE, le type DOIT être auto_entrepreneur
    company_type = CASE
        WHEN legal_form = 'auto_entrepreneur' THEN 'auto_entrepreneur'::company_type_enum
        ELSE 'societe'::company_type_enum
    END,
    -- Bonus : on vire le capital social pour l'auto-entrepreneur (c'est illégal/impossible)
    capital_social = CASE
        WHEN legal_form = 'auto_entrepreneur' THEN 0
        ELSE capital_social
    END;

-- 3. Ajout de la colonne legal_form à la table onboarding pour le tunnel
ALTER TABLE public.onboarding
ADD COLUMN IF NOT EXISTS legal_form public.legal_form_enum DEFAULT 'auto_entrepreneur';

-- 4. Mise à jour de la fonction d'approbation (RPC) pour propager legal_form
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

  -- 1️⃣ Créer le TENANT
  INSERT INTO tenants (
    id, name, primary_domain, email, phone, siret, legal_form, company_type, setup_completed
  )
  SELECT
    new_tenant_id, o.company_name, o.primary_domain, u.email, o.phone, o.siret,
    o.legal_form,
    CASE WHEN o.legal_form = 'auto_entrepreneur' THEN 'auto_entrepreneur'::company_type_enum ELSE 'societe'::company_type_enum END,
    false
  FROM auth.users u WHERE u.id = u_id;

  -- 2️⃣ Mettre à jour le PROFILE
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
