-- Plan 14.1-05 : demandes de devis (D-13 réduit par D-21, D-34 à D-37) et traitement manuel par owner/manager.
-- Pas de jeton de devis (D-21) : le propriétaire fixe le prix, puis accepte ou refuse.

CREATE FUNCTION public.submit_booking_request(p_tenant_id uuid, p_request_kind text, p_pickup text, p_dropoff text,
  p_pickup_time timestamptz, p_end_time timestamptz, p_passenger_count integer, p_luggage_count integer, p_vehicle_id uuid,
  p_first_name text, p_last_name text, p_email text, p_phone text, p_instructions text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  t public.tenants; s record; v_customer uuid; v_total numeric; v_mode public.pricing_mode;
  v_type public.booking_type_enum; v_duration numeric; v_prefix text;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_pickup text := trim(coalesce(p_pickup, ''));
  v_first text := trim(coalesce(p_first_name, ''));
BEGIN
  SELECT * INTO t FROM public.tenants WHERE id = p_tenant_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande impossible' USING ERRCODE = '22023'; END IF;
  IF p_request_kind IS NULL OR p_request_kind NOT IN ('mise_a_disposition','longue_distance') THEN
    RAISE EXCEPTION 'Type de demande invalide' USING ERRCODE = '22023';
  END IF;
  IF v_pickup = '' OR char_length(v_pickup) > 500 OR char_length(coalesce(p_dropoff, '')) > 500
     OR v_first = '' OR char_length(v_first) > 100 OR char_length(coalesce(p_last_name, '')) > 100
     OR char_length(coalesce(p_phone, '')) > 30 THEN
    RAISE EXCEPTION 'Demande invalide' USING ERRCODE = '22023';
  END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+$' OR char_length(v_email) > 254 THEN
    RAISE EXCEPTION 'Email invalide' USING ERRCODE = '22023';
  END IF;
  IF p_pickup_time IS NULL OR p_pickup_time < now() + interval '2 hours' OR p_pickup_time > now() + interval '2 years' THEN
    RAISE EXCEPTION 'Date invalide' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_passenger_count, 1) NOT BETWEEN 1 AND 8 OR coalesce(p_luggage_count, 0) NOT BETWEEN 0 AND 10 THEN
    RAISE EXCEPTION 'Nombre de passagers ou de bagages invalide' USING ERRCODE = '22023';
  END IF;
  IF p_vehicle_id IS NOT NULL AND NOT EXISTS
     (SELECT 1 FROM public.vehicles v WHERE v.id = p_vehicle_id AND v.tenant_id = p_tenant_id) THEN
    RAISE EXCEPTION 'Véhicule invalide' USING ERRCODE = '22023';
  END IF;
  IF p_request_kind = 'mise_a_disposition' THEN
    IF p_end_time IS NULL OR p_end_time <= p_pickup_time THEN
      RAISE EXCEPTION 'Période invalide' USING ERRCODE = '22023';
    END IF;
    v_duration := round(extract(epoch FROM (p_end_time - p_pickup_time)) / 3600, 2);
    IF v_duration NOT BETWEEN 1 AND 8760 THEN RAISE EXCEPTION 'Durée invalide' USING ERRCODE = '22023'; END IF;
    v_type := 'hourly'; v_prefix := 'Mise à disposition — ';
  ELSE
    v_type := 'transfer'; v_prefix := 'Longue distance — ';
  END IF;
  -- Anti-abus (captcha hors phase) : 3 demandes en attente par e-mail et 30 par tenant sur 24 h.
  IF (SELECT count(*) FROM public.bookings b JOIN public.customers c ON c.id = b.customer_id
       WHERE b.current_tenant_id = p_tenant_id AND b.booking_source = 'customer' AND b.status = 'pending'
         AND b.created_at > now() - interval '24 hours' AND c.email = v_email) >= 3
     OR (SELECT count(*) FROM public.bookings b
          WHERE b.current_tenant_id = p_tenant_id AND b.booking_source = 'customer' AND b.status = 'pending'
            AND b.created_at > now() - interval '24 hours') >= 30 THEN
    RAISE EXCEPTION 'Trop de demandes, réessayez plus tard' USING ERRCODE = '22023';
  END IF;
  -- Jamais d'UPDATE d'un client existant (T-14.1-32).
  INSERT INTO public.customers (tenant_id, email, first_name, last_name, phone, type)
  VALUES (p_tenant_id, v_email, v_first, coalesce(trim(p_last_name), ''), nullif(trim(coalesce(p_phone, '')), ''), 'individual')
  ON CONFLICT (tenant_id, email) DO NOTHING;
  SELECT id INTO v_customer FROM public.customers WHERE tenant_id = p_tenant_id AND email = v_email;
  -- Prix pré-rempli par la base (D-34), jamais renvoyé à l'appelant ; aucun plafond ni contrôle de créneau (D-37).
  IF p_request_kind = 'mise_a_disposition' THEN
    v_total := coalesce(public.calculate_booking_price(p_tenant_id, p_vehicle_id, 'hourly', 0, v_duration), 0);
  ELSE
    v_total := 0;
  END IF;
  v_mode := CASE WHEN v_total > 0 THEN 'direct' ELSE 'manual' END;
  SELECT * INTO s FROM public.booking_vat_split(v_total, t.vat_rate, t.is_vat_exempt);
  INSERT INTO public.bookings (original_tenant_id, current_tenant_id, customer_id, vehicle_id, pickup_address, dropoff_address,
    pickup_time, total_amount, subtotal_amount, vat_amount, status, mission_status, payment_mode, booking_source,
    pricing_mode, booking_type, passenger_count, luggage_count, duration_hours, instructions)
  VALUES (p_tenant_id, p_tenant_id, v_customer, p_vehicle_id, v_pickup,
    coalesce(nullif(trim(p_dropoff), ''), v_pickup), p_pickup_time, s.gross, s.net, s.vat, 'pending', 'to_validate', 'cash',
    'customer', v_mode, v_type, coalesce(p_passenger_count, 1), coalesce(p_luggage_count, 0), v_duration,
    left(v_prefix || coalesce(trim(p_instructions), ''), 500));
  RETURN true;
END $$;

REVOKE EXECUTE ON FUNCTION public.submit_booking_request(uuid, text, text, text, timestamptz, timestamptz, integer, integer, uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_booking_request(uuid, text, text, text, timestamptz, timestamptz, integer, integer, uuid, text, text, text, text, text) TO anon, authenticated;

-- Contrôle commun owner/manager : course pending du tenant, verrouillée.
CREATE FUNCTION public.authorize_quote(p_booking_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_role public.tenant_role := public.current_tenant_role();
  v_tenant uuid := public.current_tenant_id();
  b public.bookings;
BEGIN
  IF v_tenant IS NULL OR v_role IS NULL OR v_role NOT IN ('owner','manager') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id AND current_tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Course introuvable' USING ERRCODE = 'P0002'; END IF;
  IF b.status <> 'pending' THEN RAISE EXCEPTION 'Demande déjà traitée' USING ERRCODE = '22023'; END IF;
  IF b.total_amount <= 0 THEN RAISE EXCEPTION 'Fixer le prix avant le devis' USING ERRCODE = '22023'; END IF;
END $$;

CREATE FUNCTION public.accept_quote_manually(p_booking_id uuid, p_force boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_role public.tenant_role := public.current_tenant_role();
  v_tenant uuid := public.current_tenant_id();
  b public.bookings; v_conf text;
BEGIN
  IF v_tenant IS NULL OR v_role IS NULL OR v_role NOT IN ('owner','manager') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id AND current_tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Course introuvable' USING ERRCODE = 'P0002'; END IF;
  IF b.status = 'accepted' AND b.mission_status = 'not_started' THEN RETURN 'accepted'; END IF;
  IF b.status <> 'pending' THEN RAISE EXCEPTION 'Demande déjà traitée' USING ERRCODE = '22023'; END IF;
  IF b.total_amount <= 0 THEN RAISE EXCEPTION 'Fixer le prix avant d''accepter' USING ERRCODE = '22023'; END IF;
  -- Chevauchement avec un engagement existant (D-36) : confirmation explicite requise.
  IF NOT coalesce(p_force, false) THEN
    SELECT string_agg(to_char(x.other_pickup_time AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY HH24:MI') || ' (' || x.other_pickup_address || ')', ', ')
      INTO v_conf
      FROM (SELECT * FROM public.booking_conflicts(p_booking_id) ORDER BY other_pickup_time LIMIT 3) x;
    IF v_conf IS NOT NULL THEN
      RAISE EXCEPTION 'Conflit de créneau : %', v_conf USING ERRCODE = '22023';
    END IF;
  END IF;
  UPDATE public.bookings SET
    status = 'accepted', mission_status = 'not_started',
    mission_note = CASE WHEN coalesce(mission_note, '') = '' THEN '' ELSE mission_note || E'\n' END
                   || '[devis] accepté (manuel)' || CASE WHEN coalesce(p_force, false) THEN ' | conflit confirmé' ELSE '' END
  WHERE id = b.id;
  RETURN 'accepted';
END $$;

CREATE FUNCTION public.decline_booking_request(p_booking_id uuid, p_reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_role public.tenant_role := public.current_tenant_role();
  v_tenant uuid := public.current_tenant_id();
  b public.bookings; v_reason text := trim(coalesce(p_reason, ''));
BEGIN
  IF v_tenant IS NULL OR v_role IS NULL OR v_role NOT IN ('owner','manager') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_reason = '' OR char_length(v_reason) > 500 THEN RAISE EXCEPTION 'Motif invalide' USING ERRCODE = '22023'; END IF;
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id AND current_tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Course introuvable' USING ERRCODE = 'P0002'; END IF;
  IF b.status <> 'pending' THEN RAISE EXCEPTION 'Demande déjà traitée' USING ERRCODE = '22023'; END IF;
  UPDATE public.bookings SET
    status = 'cancelled_no_refund', cancelled_at = now() AT TIME ZONE 'UTC',
    cancellation_initiator = v_role::text, cancellation_reason = 'other', cancellation_note = v_reason,
    mission_note = CASE WHEN coalesce(mission_note, '') = '' THEN '' ELSE mission_note || E'\n' END
                   || '[demande] refusée | motif=' || v_reason
  WHERE id = b.id;
  RETURN 'cancelled_no_refund';
END $$;

REVOKE EXECUTE ON FUNCTION public.authorize_quote(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_quote(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_quote_manually(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_quote_manually(uuid, boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.decline_booking_request(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decline_booking_request(uuid, text) TO authenticated;
