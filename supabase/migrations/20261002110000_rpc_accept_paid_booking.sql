-- Plan 14.1-02 : prise en main d'une course payée, en RPC gardée par rôle.
-- Remplace l'Edge Function accept-booking (service_role sans contrôle, transition paid > accepted absente).
-- Le statut reste 'paid' : une course payée se termine par paid > completed.

CREATE FUNCTION public.accept_paid_booking(p_booking_id uuid, p_driver_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_role public.tenant_role := public.current_tenant_role();
  v_tenant uuid := public.current_tenant_id();
  b public.bookings;
BEGIN
  IF v_tenant IS NULL OR v_role IS NULL OR v_role NOT IN ('owner','manager','driver') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_booking_id IS NULL OR p_driver_id IS NULL THEN
    RAISE EXCEPTION 'Invalid payload' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO b FROM public.bookings
   WHERE id = p_booking_id AND current_tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'P0002'; END IF;
  -- Un chauffeur ne prend la main que pour lui-même.
  IF v_role = 'driver' AND p_driver_id IS DISTINCT FROM
     (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid() AND d.tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.drivers WHERE id = p_driver_id AND tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'Chauffeur inconnu' USING ERRCODE = '22023';
  END IF;
  IF b.status <> 'paid' THEN RAISE EXCEPTION 'Course non payée' USING ERRCODE = '22023'; END IF;
  -- Idempotence : déjà affectée à ce chauffeur et prête -> succès sans écriture.
  IF b.driver_id = p_driver_id AND b.mission_status = 'not_started' THEN RETURN 'not_started'; END IF;
  IF b.mission_status <> 'to_validate' THEN
    RAISE EXCEPTION 'Mission déjà prise en charge' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('vtc.trusted_rpc', 'on', true);
  UPDATE public.bookings SET driver_id = p_driver_id, mission_status = 'not_started' WHERE id = b.id;
  PERFORM set_config('vtc.trusted_rpc', '', true);
  RETURN 'not_started';
END $$;

REVOKE EXECUTE ON FUNCTION public.accept_paid_booking(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_paid_booking(uuid, uuid) TO authenticated;
