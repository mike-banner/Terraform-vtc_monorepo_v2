-- Phase 16 (plan 11) : première connexion guidée en React. L'identité légale est enregistrée seule par cette RPC ;
-- le véhicule et le tarif sont ensuite créés par les formulaires partagés (create_vehicle, pricing_rules).
-- Un p_vehicle ou p_pricing absent, null ou {} est donc ignoré (rien n'est inséré). Sans p_vehicle, le propriétaire
-- est le premier chauffeur : sa fiche est créée avec la carte VTC. Avec p_vehicle, comportement inchangé.
-- Signature inchangée : droits d'exécution conservés.

CREATE OR REPLACE FUNCTION public.complete_tenant_setup(p_legal jsonb, p_vehicle jsonb, p_pricing jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id(); t public.tenants; pr public.profiles;
  v_form text := p_legal->>'legal_form'; v_driver uuid; v_primary boolean;
  v_license text := trim(coalesce(p_legal->>'vtc_license_number', ''));
  v_siret text := p_legal->>'siret'; v_cat text := p_vehicle->>'category';
  v_has_vehicle boolean := coalesce(p_vehicle, '{}'::jsonb) NOT IN ('{}'::jsonb, 'null'::jsonb);
  v_has_pricing boolean := coalesce(p_pricing, '{}'::jsonb) NOT IN ('{}'::jsonb, 'null'::jsonb);
BEGIN
  IF v_tenant IS NULL OR public.current_tenant_role() IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO t FROM public.tenants WHERE id = v_tenant FOR UPDATE;
  IF t.setup_completed IS TRUE THEN
    RAISE EXCEPTION 'Configuration déjà effectuée' USING ERRCODE = '42501';
  END IF;
  IF v_form IS NULL OR v_form NOT IN (SELECT unnest(enum_range(NULL::public.legal_form_enum))::text) THEN
    RAISE EXCEPTION 'Forme juridique invalide' USING ERRCODE = '22023';
  END IF;
  IF v_siret IS NULL OR v_siret !~ '^[0-9]{14}$' THEN
    RAISE EXCEPTION 'SIRET invalide' USING ERRCODE = '22023';
  END IF;
  IF v_has_vehicle THEN
    IF v_cat IS NULL OR v_cat NOT IN (SELECT unnest(enum_range(NULL::public.vehicle_category_enum))::text) THEN
      RAISE EXCEPTION 'Catégorie de véhicule invalide' USING ERRCODE = '22023';
    END IF;
    IF trim(coalesce(p_vehicle->>'brand', '')) = '' OR trim(coalesce(p_vehicle->>'model', '')) = ''
       OR trim(coalesce(p_vehicle->>'plate_number', '')) = '' THEN
      RAISE EXCEPTION 'Véhicule incomplet' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF v_has_pricing AND ((p_pricing->>'base_price')::numeric < 0 OR (p_pricing->>'price_per_km')::numeric < 0
     OR (p_pricing->>'minimum_fare')::numeric < 0) THEN
    RAISE EXCEPTION 'Tarif invalide' USING ERRCODE = '22023';
  END IF;
  v_primary := CASE WHEN v_has_vehicle THEN coalesce((p_vehicle->>'is_primary_driver')::boolean, false) ELSE true END;
  IF v_primary THEN
    IF v_license = '' THEN RAISE EXCEPTION 'Numéro de carte VTC requis' USING ERRCODE = '22023'; END IF;
    SELECT * INTO pr FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.drivers (user_id, tenant_id, first_name, last_name, phone, license_number)
    VALUES (auth.uid(), v_tenant, coalesce(pr.first_name, ''), coalesce(pr.last_name, ''), coalesce(t.phone, ''), v_license)
    ON CONFLICT (user_id) DO UPDATE SET license_number = EXCLUDED.license_number
      WHERE public.drivers.tenant_id = v_tenant
    RETURNING id INTO v_driver;
    IF v_driver IS NULL THEN
      RAISE EXCEPTION 'Fiche chauffeur rattachée à un autre tenant' USING ERRCODE = '42501';
    END IF;
  END IF;
  UPDATE public.tenants SET
    legal_form = v_form::public.legal_form_enum,
    siret = v_siret,
    rcs_number = nullif(trim(p_legal->>'rcs_number'), ''),
    capital_social = nullif(p_legal->>'capital_social', '')::numeric,
    vat_number = CASE WHEN v_form IN ('auto_entrepreneur','ei') THEN NULL ELSE nullif(trim(p_legal->>'vat_number'), '') END,
    setup_completed = true
  WHERE id = v_tenant;
  IF v_has_vehicle THEN
    INSERT INTO public.vehicles (tenant_id, driver_id, brand, model, plate_number, category, capacity, luggage_capacity, status)
    VALUES (v_tenant, v_driver, trim(p_vehicle->>'brand'), trim(p_vehicle->>'model'), trim(p_vehicle->>'plate_number'),
            v_cat::public.vehicle_category_enum, (p_vehicle->>'capacity')::integer,
            coalesce((p_vehicle->>'luggage_capacity')::integer, 3), 'active');
  END IF;
  IF v_has_pricing THEN
    INSERT INTO public.pricing_rules (tenant_id, service_category, base_price, price_per_km, price_per_hour, minimum_fare, active)
    VALUES (v_tenant, v_cat, (p_pricing->>'base_price')::numeric, (p_pricing->>'price_per_km')::numeric,
            round(coalesce(nullif(p_pricing->>'price_per_minute', '')::numeric, 0.5) * 60, 2),
            (p_pricing->>'minimum_fare')::numeric, true);
  END IF;
END $$;
