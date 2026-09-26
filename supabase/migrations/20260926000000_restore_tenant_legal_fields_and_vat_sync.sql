-- 20260926000000_restore_tenant_legal_fields_and_vat_sync.sql
--
-- Répare approve_onboarding_tx, cassée depuis le 2026-05-31, et restaure la propagation
-- des champs légaux du dossier d'onboarding vers le tenant.
--
-- Deux régressions cumulées, toutes deux introduites par 20260531200000 (correction du
-- lien drivers.user_id), qui a redéfini la fonction en repartant d'une version périmée :
--
-- 1. BLOQUANT — le bloc « Créer le véhicule » lit o.vehicle_brand / o.vehicle_model /
--    o.plate_number, colonnes supprimées de `onboarding` deux mois plus tôt par
--    20260328193200_onboarding_v4_clean.sql. PL/pgSQL ne compile le corps qu'à
--    l'exécution : la fonction se crée sans erreur et échoue au premier appel sur
--    « column o.vehicle_brand does not exist ». Plus aucun onboarding n'était approuvable.
--    Le bloc est supprimé, pas réparé : le véhicule est créé par app/setup.astro, avec
--    des champs que l'onboarding ne collecte plus (catégorie, capacité, statut).
--
-- 2. FISCAL — 20260401183000 propageait siret / legal_form / company_type /
--    setup_completed. L'INSERT régressé se limitait à (id, name, primary_domain, email,
--    phone). Le tenant naissait donc avec legal_form NULL, et les deux triggers de
--    synchronisation TVA (trg_set_tenant_vat_on_insert de 20260531000000 et
--    trg_sync_tenant_vat de 20260530000001) restaient muets faute de forme juridique à
--    tester. Les valeurs par défaut s'appliquaient : vat_rate = 0, is_vat_exempt = true.
--    Une SASU assujettie émettait des factures sans TVA portant la mention
--    « Art. 293 B CGI », réservée à la franchise en base, et sans SIRET.
--
-- Aucun trigger n'est créé ici : celui qui couvre l'INSERT existe déjà et redevient
-- fonctionnel dès que legal_form est renseigné à la création.

-- 1. approve_onboarding_tx : champs légaux restaurés, bloc véhicule mort supprimé.
--    SECURITY DEFINER et search_path figé sont conservés — la fonction crée un tenant
--    pour un utilisateur `pending` qui n'en a pas le droit, elle traverse donc la RLS.
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

-- 2. Backfill des tenants créés par la version régressée : forme juridique et SIRET
--    repris du dossier d'onboarding de leur owner. L'UPDATE de legal_form déclenche
--    trg_sync_tenant_vat, qui aligne is_vat_exempt et vat_rate.
UPDATE public.tenants t
SET legal_form = o.legal_form,
    siret      = COALESCE(t.siret, o.siret)
FROM public.onboarding o
JOIN public.profiles p ON p.id = o.profile_id
WHERE p.tenant_id = t.id
  AND p.tenant_role = 'owner'
  AND t.legal_form IS NULL
  AND o.legal_form IS NOT NULL;

-- 3. Privilèges rappelés. CREATE OR REPLACE conserve les droits existants, mais on
--    réaffirme l'intention de la Phase 10 sur une fonction SECURITY DEFINER.
--    PUBLIC est visé explicitement : Postgres accorde EXECUTE à ce pseudo-rôle à la
--    création d'une fonction, et révoquer anon/authenticated ne retire pas ce droit hérité.
REVOKE EXECUTE ON FUNCTION public.approve_onboarding_tx(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_onboarding_tx(uuid) FROM anon, authenticated;
