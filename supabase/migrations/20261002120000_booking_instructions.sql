-- Plan 14.1-03 : instructions du client (D-10), distinctes du journal mission_note.
ALTER TABLE public.bookings ADD COLUMN instructions text CHECK (instructions IS NULL OR char_length(instructions) <= 500);

-- Reprise des lignes libres de mission_note (celles qui ne commencent pas par '[').
UPDATE public.bookings SET instructions = left(nullif(trim(array_to_string(ARRAY(SELECT l FROM unnest(string_to_array(mission_note, E'\n')) AS l WHERE trim(l) <> '' AND left(trim(l),1) <> '['), E'\n')), ''), 500)
 WHERE mission_note IS NOT NULL AND instructions IS NULL;

DROP FUNCTION public.create_manual_booking(text, text, timestamptz, text, text, text, numeric, text, numeric, numeric, integer, integer, uuid);

CREATE FUNCTION public.create_manual_booking(p_pickup text, p_dropoff text, p_pickup_time timestamptz,
  p_client_name text, p_client_email text, p_payment_mode text DEFAULT 'cash', p_manual_total numeric DEFAULT NULL,
  p_booking_type text DEFAULT 'transfer', p_distance_km numeric DEFAULT NULL, p_duration_hours numeric DEFAULT NULL,
  p_passenger_count integer DEFAULT 1, p_luggage_count integer DEFAULT 0, p_vehicle_id uuid DEFAULT NULL, p_instructions text DEFAULT NULL)
RETURNS TABLE(booking_id uuid, total_price numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_role public.tenant_role := public.current_tenant_role();
  v_tenant uuid := public.current_tenant_id();
  v_driver uuid; v_vehicle uuid; v_customer uuid; v_total numeric; v_mode public.pricing_mode;
  v_email text := lower(trim(coalesce(p_client_email, '')));
  v_name text := trim(coalesce(p_client_name, ''));
  v_type public.booking_type_enum; t public.tenants; s record; v_id uuid;
BEGIN
  IF v_tenant IS NULL OR v_role IS NULL OR v_role NOT IN ('owner','manager') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF trim(coalesce(p_pickup, '')) = '' OR p_pickup_time IS NULL THEN
    RAISE EXCEPTION 'Adresse de départ et date requises' USING ERRCODE = '22023';
  END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Email client invalide' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_booking_type, 'transfer') NOT IN ('transfer','hourly') THEN
    RAISE EXCEPTION 'Type de course invalide' USING ERRCODE = '22023';
  END IF;
  v_type := coalesce(p_booking_type, 'transfer')::public.booking_type_enum;
  IF coalesce(p_payment_mode, 'cash') NOT IN ('cash','card','stripe') THEN
    RAISE EXCEPTION 'Mode de paiement invalide' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_passenger_count, 1) < 1 OR coalesce(p_luggage_count, 0) < 0 THEN
    RAISE EXCEPTION 'Nombre de passagers ou de bagages invalide' USING ERRCODE = '22023';
  END IF;
  SELECT d.id INTO v_driver FROM public.drivers d
   WHERE d.tenant_id = v_tenant AND d.user_id = auth.uid() LIMIT 1;
  IF v_driver IS NULL THEN
    RAISE EXCEPTION 'Profil chauffeur introuvable. Crée ton profil chauffeur avant de créer une course manuelle.' USING ERRCODE = '22023';
  END IF;
  IF p_vehicle_id IS NOT NULL THEN
    SELECT v.id INTO v_vehicle FROM public.vehicles v WHERE v.id = p_vehicle_id AND v.tenant_id = v_tenant;
    IF v_vehicle IS NULL THEN RAISE EXCEPTION 'Véhicule introuvable pour ce tenant' USING ERRCODE = '22023'; END IF;
  ELSE
    SELECT v.id INTO v_vehicle FROM public.vehicles v WHERE v.driver_id = v_driver ORDER BY v.created_at LIMIT 1;
    IF v_vehicle IS NULL THEN
      RAISE EXCEPTION 'Aucun véhicule associé à ton profil chauffeur. Ajoute/associe un véhicule avant de créer une course manuelle.' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF coalesce(p_manual_total, 0) > 0 THEN
    v_total := p_manual_total; v_mode := 'manual';
  ELSE
    v_total := public.calculate_booking_price(v_tenant, v_vehicle, v_type,
                 coalesce(p_distance_km, 0), coalesce(nullif(p_duration_hours, 0), 1));
    v_mode := 'direct';
    IF v_total IS NULL THEN
      RAISE EXCEPTION 'Aucune règle tarifaire active et aucun montant manuel fourni.' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF v_total <= 0 OR v_total > 9999 THEN
    RAISE EXCEPTION 'Montant invalide : %€', v_total USING ERRCODE = '22023';
  END IF;
  SELECT c.id INTO v_customer FROM public.customers c WHERE c.tenant_id = v_tenant AND c.email = v_email LIMIT 1;
  IF v_customer IS NULL THEN
    INSERT INTO public.customers (tenant_id, email, first_name, last_name, type)
    VALUES (v_tenant, v_email, split_part(v_name, ' ', 1),
            coalesce(nullif(trim(substr(v_name, length(split_part(v_name, ' ', 1)) + 1)), ''), ''), 'individual')
    RETURNING id INTO v_customer;
  END IF;
  SELECT * INTO t FROM public.tenants WHERE id = v_tenant;
  SELECT * INTO s FROM public.booking_vat_split(v_total, t.vat_rate, t.is_vat_exempt);
  INSERT INTO public.bookings (original_tenant_id, current_tenant_id, customer_id, pickup_address, dropoff_address,
    pickup_time, total_amount, subtotal_amount, vat_amount, status, mission_status, payment_mode, booking_source,
    pricing_mode, booking_type, passenger_count, luggage_count, distance_km, duration_hours, driver_id, vehicle_id, instructions)
  VALUES (v_tenant, v_tenant, v_customer, trim(p_pickup),
    coalesce(nullif(trim(p_dropoff), ''), trim(p_pickup), 'À définir'),
    p_pickup_time, s.gross, s.net, s.vat, 'accepted', 'not_started', coalesce(p_payment_mode, 'cash')::public.payment_mode,
    'manual_driver', v_mode, v_type, coalesce(p_passenger_count, 1), coalesce(p_luggage_count, 0),
    nullif(p_distance_km, 0), nullif(p_duration_hours, 0), v_driver, v_vehicle,
    nullif(left(trim(coalesce(p_instructions, '')), 500), ''))
  RETURNING id INTO v_id;
  RETURN QUERY SELECT v_id, s.gross;
END $$;

REVOKE EXECUTE ON FUNCTION public.create_manual_booking(text, text, timestamptz, text, text, text, numeric, text, numeric, numeric, integer, integer, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_manual_booking(text, text, timestamptz, text, text, text, numeric, text, numeric, numeric, integer, integer, uuid, text) TO authenticated;

CREATE FUNCTION public.update_booking_instructions(p_booking_id uuid, p_instructions text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_role public.tenant_role := public.current_tenant_role();
  v_tenant uuid := public.current_tenant_id();
  b public.bookings; v_val text := nullif(trim(coalesce(p_instructions, '')), '');
BEGIN
  IF v_tenant IS NULL OR v_role IS NULL OR v_role NOT IN ('owner','manager','driver') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id AND current_tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'P0002'; END IF;
  IF v_role = 'driver' AND b.driver_id IS DISTINCT FROM
     (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid() AND d.tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF b.mission_status NOT IN ('to_validate','not_started')
     OR b.status NOT IN ('pending','accepted','accepted_pending_payment','paid') THEN
    RAISE EXCEPTION 'Instructions modifiables seulement avant la mission' USING ERRCODE = '22023';
  END IF;
  UPDATE public.bookings SET instructions = v_val WHERE id = b.id;
  RETURN v_val;
END $$;

REVOKE EXECUTE ON FUNCTION public.update_booking_instructions(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_booking_instructions(uuid, text) TO authenticated;
