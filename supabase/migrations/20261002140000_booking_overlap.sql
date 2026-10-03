-- Plan 14.1-05 : fenêtre d'occupation d'une course et détection des chevauchements (D-36, D-40).

-- Fenêtre [début, début + durée). 4 h par défaut pour un transfert sans durée (A12, D-40) ;
-- durée négative = plage vide ; plafonnée à 8 760 h.
CREATE FUNCTION public.booking_window(p_pickup timestamptz, p_hours numeric)
RETURNS tstzrange LANGUAGE sql STABLE AS $$
  SELECT tstzrange(p_pickup,
    p_pickup + make_interval(secs => round(least(greatest(coalesce(nullif(p_hours, 0), 4), 0), 8760) * 3600)), '[)')
$$;

REVOKE EXECUTE ON FUNCTION public.booking_window(timestamptz, numeric) FROM PUBLIC, anon, authenticated;

-- Paires en conflit pour owner/manager. Sujet : pending/accepted/paid non terminée ; autre : accepted/paid non terminée.
-- Conflit : fenêtres qui se recouvrent ET (même chauffeur OU l'une des deux non affectée).
CREATE FUNCTION public.booking_conflicts(p_booking_id uuid DEFAULT NULL)
RETURNS TABLE(booking_id uuid, other_id uuid, other_pickup_time timestamptz, other_end_time timestamptz,
  other_status text, other_pickup_address text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_role public.tenant_role := public.current_tenant_role();
  v_tenant uuid := public.current_tenant_id();
BEGIN
  IF v_tenant IS NULL OR v_role IS NULL OR v_role NOT IN ('owner','manager') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_booking_id IS NOT NULL AND NOT EXISTS
     (SELECT 1 FROM public.bookings x WHERE x.id = p_booking_id AND x.current_tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'Course introuvable' USING ERRCODE = 'P0002';
  END IF;
  RETURN QUERY
  SELECT s.id, o.id, o.pickup_time, upper(public.booking_window(o.pickup_time, o.duration_hours)),
         o.status::text, o.pickup_address
    FROM public.bookings s
    JOIN public.bookings o ON o.current_tenant_id = s.current_tenant_id AND o.id <> s.id
   WHERE s.current_tenant_id = v_tenant
     AND s.status IN ('pending','accepted','paid') AND s.mission_status <> 'completed'
     AND (s.id = p_booking_id OR (p_booking_id IS NULL
          AND upper(public.booking_window(s.pickup_time, s.duration_hours)) > now()))
     AND o.status IN ('accepted','paid') AND o.mission_status <> 'completed'
     AND public.booking_window(s.pickup_time, s.duration_hours) && public.booking_window(o.pickup_time, o.duration_hours)
     AND (s.driver_id IS NULL OR o.driver_id IS NULL OR s.driver_id = o.driver_id)
   ORDER BY s.pickup_time, o.pickup_time;
END $$;

REVOKE EXECUTE ON FUNCTION public.booking_conflicts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_conflicts(uuid) TO authenticated;
