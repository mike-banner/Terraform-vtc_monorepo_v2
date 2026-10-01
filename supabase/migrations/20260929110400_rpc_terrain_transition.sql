-- D-06/D-07 Phase 14 : transitions terrain (en route, à bord, terminée) en RPC gardée par rôle.
-- Remplace la logique de apps/vtc-backoffice/src/pages/api/missions/terrain-transition.ts.
-- H-15 : ADR-002. Marqueur de confiance pour l'encaissement cash du trigger ledger : ADR-012.
-- Filtre tenant : current_tenant_id seul, comme la route actuelle.

CREATE FUNCTION public.terrain_transition(p_booking_id uuid, p_action text, p_corrected_at timestamptz DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_role public.tenant_role := public.current_tenant_role();
  v_tenant uuid := public.current_tenant_id();
  b public.bookings;
  v_tag text; v_ts timestamptz; v_note text;
  v_iso constant text := 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"';
BEGIN
  IF v_tenant IS NULL OR v_role IS NULL OR v_role NOT IN ('owner','manager','driver') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  v_tag := CASE p_action WHEN 'en_route' THEN 'en_route_at' WHEN 'on_board' THEN 'on_board_at'
                         WHEN 'completed' THEN 'completed_at' END;
  IF v_tag IS NULL OR p_booking_id IS NULL THEN
    RAISE EXCEPTION 'Invalid payload' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO b FROM public.bookings
   WHERE id = p_booking_id AND current_tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'P0002'; END IF;
  IF v_role = 'driver' AND b.driver_id IS DISTINCT FROM
     (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid() AND d.tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  -- Idempotence (D-07) : marqueur déjà posé -> succès sans écriture.
  IF position('[terrain] ' || v_tag || '=' IN coalesce(b.mission_note, '')) > 0 THEN
    RETURN coalesce(b.mission_note, '');
  END IF;
  -- H-15 (ADR-002)
  IF p_action = 'en_route' AND now() < b.pickup_time - interval '15 minutes' THEN
    RAISE EXCEPTION 'Too early' USING ERRCODE = 'P0001',
      DETAIL = to_char((b.pickup_time - interval '15 minutes') AT TIME ZONE 'UTC', v_iso);
  END IF;
  -- DECISION-CASH: C1 (plan 14-01) : accepted -> completed réservé au cash.
  IF p_action = 'completed' AND b.status = 'accepted' AND b.payment_mode <> 'cash' THEN
    RAISE EXCEPTION 'Paiement non encaissé' USING ERRCODE = '22023';
  END IF;
  v_ts := CASE WHEN p_action = 'completed' AND p_corrected_at IS NOT NULL THEN p_corrected_at ELSE now() END;
  v_note := coalesce(b.mission_note, '');
  v_note := v_note || CASE WHEN v_note = '' THEN '' ELSE E'\n' END
            || '[terrain] ' || v_tag || '=' || to_char(v_ts AT TIME ZONE 'UTC', v_iso)
            || CASE WHEN p_action = 'completed' AND p_corrected_at IS NOT NULL
                    THEN E'\n[terrain] completed_at_was_corrected=true' ELSE '' END;
  PERFORM set_config('vtc.trusted_rpc', 'on', true);
  UPDATE public.bookings SET
    mission_note = v_note,
    mission_status = CASE p_action WHEN 'en_route' THEN 'in_progress'::public.mission_status_enum
                                   WHEN 'completed' THEN 'completed'::public.mission_status_enum
                                   ELSE mission_status END,
    status = CASE WHEN p_action = 'completed' THEN 'completed'::public.booking_status ELSE status END
  WHERE id = b.id;
  PERFORM set_config('vtc.trusted_rpc', '', true);
  RETURN v_note;
END $$;

REVOKE EXECUTE ON FUNCTION public.terrain_transition(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.terrain_transition(uuid, text, timestamptz) TO authenticated;
