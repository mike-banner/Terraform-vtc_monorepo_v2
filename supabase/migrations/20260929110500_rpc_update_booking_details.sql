-- D-06/D-03 Phase 14 : modification pré-mission d'une course (heure, adresses) avec recalcul serveur du prix et de la TVA.
-- DECISION-EDIT: A (plan 14-01) : statuts modifiables pending et accepted, prix manuel conservé, HT/TVA recalculés
-- avec la TVA actuelle du tenant. Marqueur de confiance : ADR-012.
-- Le refus des statuts payés est codé ici : trg_prevent_pickup_time_change_after_paid est désactivé en prod.
-- Correction assumée : la TVA est recalculée (l'ancienne route laissait vat_amount inchangé et subtotal = total).

CREATE FUNCTION public.update_booking_details(p_booking_id uuid, p_pickup_time timestamptz, p_pickup_address text,
  p_dropoff_address text DEFAULT NULL, p_distance_km numeric DEFAULT NULL, p_duration_hours numeric DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_role public.tenant_role := public.current_tenant_role();
  v_tenant uuid := public.current_tenant_id();
  b public.bookings; t public.tenants; v_total numeric; v_calc numeric; s record;
BEGIN
  IF v_tenant IS NULL OR v_role IS NULL OR v_role NOT IN ('owner','manager','driver') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_pickup_time IS NULL OR trim(coalesce(p_pickup_address, '')) = '' THEN
    RAISE EXCEPTION 'Date/heure et adresse de départ requis' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id AND current_tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Course introuvable' USING ERRCODE = 'P0002'; END IF;
  IF v_role = 'driver' AND b.driver_id IS DISTINCT FROM
     (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid() AND d.tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF coalesce(b.mission_status::text, '') NOT IN ('to_validate','not_started') THEN
    RAISE EXCEPTION 'Action impossible : mission déjà démarrée ou terminée' USING ERRCODE = '22023';
  END IF;
  -- DECISION-EDIT: A (plan 14-01) ; variante B : IN ('pending')
  IF b.status NOT IN ('pending','accepted') THEN
    RAISE EXCEPTION 'Course non modifiable dans ce statut' USING ERRCODE = '22023';
  END IF;
  v_total := b.total_amount;
  IF b.pricing_mode <> 'manual' AND b.vehicle_id IS NOT NULL THEN
    v_calc := public.calculate_booking_price(v_tenant, b.vehicle_id, b.booking_type,
                coalesce(p_distance_km, b.distance_km, 0), coalesce(p_duration_hours, b.duration_hours, 1));
    IF v_calc > 0 THEN v_total := v_calc; END IF;
  END IF;
  SELECT * INTO t FROM public.tenants WHERE id = v_tenant;
  SELECT * INTO s FROM public.booking_vat_split(v_total, t.vat_rate, t.is_vat_exempt);
  PERFORM set_config('vtc.trusted_rpc', 'on', true);
  UPDATE public.bookings SET
    pickup_time = p_pickup_time,
    pickup_address = trim(p_pickup_address),
    dropoff_address = coalesce(nullif(trim(p_dropoff_address), ''), dropoff_address),
    distance_km = coalesce(p_distance_km, distance_km),
    duration_hours = coalesce(p_duration_hours, duration_hours),
    total_amount = s.gross, subtotal_amount = s.net, vat_amount = s.vat
  WHERE id = b.id;
  PERFORM set_config('vtc.trusted_rpc', '', true);
  RETURN s.gross;
END $$;

REVOKE EXECUTE ON FUNCTION public.update_booking_details(uuid, timestamptz, text, text, numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_booking_details(uuid, timestamptz, text, text, numeric, numeric) TO authenticated;
