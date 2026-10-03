-- Phase 16 (D-02 a) : aperçu de prix côté serveur pour la nouvelle course.
-- Le navigateur ne calcule plus aucun prix. Aperçu non contractuel : create_manual_booking recalcule et fait foi.

CREATE FUNCTION public.quote_booking_estimate(
  p_vehicle_id uuid,
  p_booking_type public.booking_type_enum,
  p_distance_km numeric DEFAULT NULL,
  p_duration_hours numeric DEFAULT NULL,
  p_fixed_route_id uuid DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_role public.tenant_role := public.current_tenant_role();
  v_price numeric;
BEGIN
  IF v_tenant IS NULL OR v_role IS NULL OR v_role NOT IN ('owner','manager') THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = p_vehicle_id AND v.tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'Véhicule ou trajet introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF p_fixed_route_id IS NOT NULL THEN
    SELECT r.price INTO v_price FROM public.fixed_routes r
     WHERE r.id = p_fixed_route_id AND r.tenant_id = v_tenant AND r.active;
    IF v_price IS NULL THEN
      RAISE EXCEPTION 'Véhicule ou trajet introuvable' USING ERRCODE = 'P0002';
    END IF;
    RETURN v_price;
  END IF;
  -- Mêmes coalesce que create_manual_booking
  RETURN public.calculate_booking_price(v_tenant, p_vehicle_id, p_booking_type,
           coalesce(p_distance_km, 0), coalesce(nullif(p_duration_hours, 0), 1));
END $$;

REVOKE EXECUTE ON FUNCTION public.quote_booking_estimate(uuid, public.booking_type_enum, numeric, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quote_booking_estimate(uuid, public.booking_type_enum, numeric, numeric, uuid) TO authenticated;
