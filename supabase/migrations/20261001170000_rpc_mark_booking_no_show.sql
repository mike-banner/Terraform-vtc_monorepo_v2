-- Course non réalisée (client absent) : issue propre pour une course acceptée dont l'heure de prise en charge est
-- passée et dont la mission n'a pas démarré. Aucun effet ledger (le trigger ne réagit qu'à un paiement ou à une
-- fin de course cash). Réservé à owner/manager ; un chauffeur passe par eux. Les courses payées ou en attente de
-- paiement sont refusées : leur remboursement relève de l'annulation et de l'Edge Function cancel-booking.

INSERT INTO public.booking_status_transitions (from_status, to_status) VALUES ('accepted','no_show')
ON CONFLICT (from_status, to_status) DO NOTHING;

CREATE FUNCTION public.mark_booking_no_show(p_booking_id uuid, p_reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_role public.tenant_role := public.current_tenant_role();
  v_tenant uuid := public.current_tenant_id();
  b public.bookings; v_reason text := left(trim(coalesce(p_reason, '')), 500);
BEGIN
  IF v_tenant IS NULL OR v_role IS NULL OR v_role NOT IN ('owner','manager') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id AND current_tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Course introuvable' USING ERRCODE = 'P0002'; END IF;
  -- Idempotence : déjà marquée non réalisée -> succès sans écriture.
  IF b.status = 'no_show' THEN RETURN b.status::text; END IF;
  IF coalesce(b.mission_status::text, '') NOT IN ('to_validate','not_started') THEN
    RAISE EXCEPTION 'Action impossible : mission déjà démarrée ou terminée' USING ERRCODE = '22023';
  END IF;
  IF b.status <> 'accepted' THEN
    RAISE EXCEPTION 'Course non concernée : seule une course acceptée peut être marquée non réalisée' USING ERRCODE = '22023';
  END IF;
  IF b.pickup_time > now() THEN
    RAISE EXCEPTION 'Prise en charge pas encore passée : utiliser Annuler' USING ERRCODE = '22023';
  END IF;
  IF v_reason = '' THEN
    RAISE EXCEPTION 'Motif requis' USING ERRCODE = '22023';
  END IF;
  UPDATE public.bookings SET
    status = 'no_show',
    mission_note = CASE WHEN coalesce(mission_note, '') = '' THEN '' ELSE mission_note || E'\n' END
                   || '[non réalisée] motif=' || v_reason
  WHERE id = b.id;
  RETURN 'no_show';
END $$;

REVOKE EXECUTE ON FUNCTION public.mark_booking_no_show(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_booking_no_show(uuid, text) TO authenticated;
