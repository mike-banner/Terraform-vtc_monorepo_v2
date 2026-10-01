-- D-09 Phase 14 : notation publique en deux RPC appelables par anon.
-- L'UUID de la course reste le jeton d'accès (inchangé). Rate-limit différé (CONTEXT, deferred).
-- Remplace rate/[id].astro et api/submit-rating.ts du backoffice (select('*') en service_role).

CREATE FUNCTION public.get_rating_context(p_booking_id uuid)
RETURNS TABLE(tenant_name text, logo_url text, google_reviews_url text, already_rated boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT t.name, t.logo_url, t.google_reviews_url, b.rating IS NOT NULL
  FROM public.bookings b JOIN public.tenants t ON t.id = b.current_tenant_id
  WHERE b.id = p_booking_id;
$$;

CREATE FUNCTION public.submit_rating(p_booking_id uuid, p_rating integer, p_comment text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_status public.mission_status_enum; v_rating smallint;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Note invalide (1-5)' USING ERRCODE = '22023';
  END IF;
  -- Une seule instruction : pas de fenêtre entre la vérification et l'écriture.
  UPDATE public.bookings
     SET rating = p_rating, rating_comment = left(trim(p_comment), 500), rating_created_at = now()
   WHERE id = p_booking_id AND mission_status = 'completed' AND rating IS NULL;
  IF FOUND THEN RETURN; END IF;
  SELECT mission_status, rating INTO v_status, v_rating FROM public.bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Réservation non trouvée' USING ERRCODE = 'P0002'; END IF;
  IF v_status IS DISTINCT FROM 'completed' THEN RAISE EXCEPTION 'Course non terminée' USING ERRCODE = '22023'; END IF;
  RAISE EXCEPTION 'Déjà noté' USING ERRCODE = '22023';
END $$;

REVOKE EXECUTE ON FUNCTION public.get_rating_context(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_rating(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_rating_context(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_rating(uuid, integer, text) TO anon, authenticated;
