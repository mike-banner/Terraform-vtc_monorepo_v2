-- D-06/D-07 Phase 14 : annulation d'une course par le chauffeur (ou owner/manager) en RPC gardée par rôle.
-- Remplace booking-actions, action cancel. La règle « pas d'annulation après la prise en charge » est codée ici
-- car trg_prevent_late_cancellation est désactivé en prod (constat 13-04). Le remboursement Stripe reste à
-- l'Edge Function cancel-booking (inchangée). Pas de marqueur de confiance : aucun effet ledger.

CREATE FUNCTION public.driver_cancel_booking(p_booking_id uuid, p_reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_role public.tenant_role := public.current_tenant_role();
  v_tenant uuid := public.current_tenant_id();
  b public.bookings; v_new public.booking_status; v_reason text := left(trim(coalesce(p_reason, '')), 500);
BEGIN
  IF v_tenant IS NULL OR v_role IS NULL OR v_role NOT IN ('owner','manager','driver') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO b FROM public.bookings
   WHERE id = p_booking_id AND current_tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Course introuvable' USING ERRCODE = 'P0002'; END IF;
  IF v_role = 'driver' AND b.driver_id IS DISTINCT FROM
     (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid() AND d.tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  -- Idempotence : déjà annulée par le chauffeur -> succès sans écriture.
  IF b.cancellation_initiator = 'driver'
     AND b.status IN ('cancelled_no_refund','cancelled_pending_refund','cancelled_refunded') THEN
    RETURN b.status::text;
  END IF;
  IF coalesce(b.mission_status::text, '') NOT IN ('to_validate','not_started') THEN
    RAISE EXCEPTION 'Action impossible : mission déjà démarrée ou terminée' USING ERRCODE = '22023';
  END IF;
  IF v_reason = '' THEN
    RAISE EXCEPTION 'Motif d''annulation requis (convention VTC)' USING ERRCODE = '22023';
  END IF;
  IF b.pickup_time <= now() THEN
    RAISE EXCEPTION 'Annulation impossible après l''heure de prise en charge' USING ERRCODE = '22023';
  END IF;
  v_new := CASE WHEN b.status = 'paid' THEN 'cancelled_pending_refund' ELSE 'cancelled_no_refund' END;
  UPDATE public.bookings SET
    status = v_new,
    cancelled_at = now() AT TIME ZONE 'UTC',
    cancellation_initiator = 'driver',
    mission_note = CASE WHEN coalesce(mission_note, '') = '' THEN '' ELSE mission_note || E'\n' END
                   || '[annulation] initiateur=chauffeur | motif=' || v_reason
  WHERE id = b.id;
  RETURN v_new::text;
END $$;

REVOKE EXECUTE ON FUNCTION public.driver_cancel_booking(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_cancel_booking(uuid, text) TO authenticated;
