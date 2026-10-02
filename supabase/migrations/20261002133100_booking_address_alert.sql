-- Plan 14.1-13 (D-33, D-42) : signalement serveur d'adresse hors zone, jamais un refus.
-- Aucun GRANT de colonne : écrite par le webhook (service_role) et par mark_address_verified.
ALTER TABLE public.bookings ADD COLUMN address_alert text
  CHECK (address_alert IS NULL OR address_alert IN ('hors_zone_depart','hors_zone_arrivee','hors_zone','a_verifier','verifie'));

CREATE FUNCTION public.mark_address_verified(p_booking_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_role public.tenant_role := public.current_tenant_role();
  v_tenant uuid := public.current_tenant_id();
  b public.bookings;
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
  IF b.address_alert IS NULL THEN RAISE EXCEPTION 'Aucun signalement' USING ERRCODE = '22023'; END IF;
  IF b.address_alert <> 'verifie' THEN
    UPDATE public.bookings SET address_alert = 'verifie' WHERE id = b.id;
  END IF;
  RETURN 'verifie';
END $$;

REVOKE EXECUTE ON FUNCTION public.mark_address_verified(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_address_verified(uuid) TO authenticated;
