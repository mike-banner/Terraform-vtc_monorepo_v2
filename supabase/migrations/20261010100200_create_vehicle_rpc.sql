-- Phase 16 (A-06) : création de véhicule atomique. Un véhicule actif en désactive les autres dans la même transaction.
-- SECURITY INVOKER : les policies d'écriture de vehicles (owner/manager du tenant) s'appliquent.

CREATE FUNCTION public.create_vehicle(p_brand text, p_model text, p_plate_number text,
  p_category public.vehicle_category_enum, p_capacity int, p_status text)
RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_role public.tenant_role := public.current_tenant_role();
  v_status public.vehicle_status_enum := p_status::public.vehicle_status_enum;
  v_id uuid;
BEGIN
  IF v_tenant IS NULL OR v_role IS NULL OR v_role NOT IN ('owner','manager') THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  IF v_status = 'active' THEN
    UPDATE public.vehicles SET status = 'inactive' WHERE tenant_id = v_tenant AND status = 'active';
  END IF;
  INSERT INTO public.vehicles (tenant_id, brand, model, plate_number, category, capacity, status)
  VALUES (v_tenant, p_brand, p_model, p_plate_number, p_category, p_capacity, v_status)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.create_vehicle(text, text, text, public.vehicle_category_enum, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_vehicle(text, text, text, public.vehicle_category_enum, int, text) TO authenticated;
