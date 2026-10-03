-- Le numéro FAC- est attribué et enregistré sur la course dans la même transaction (L441-3 : pas de trou).
-- Autorisation par le JWT de l'appelant : owner/manager du tenant de la course.
CREATE FUNCTION public.assign_invoice_number(p_booking_id uuid)
RETURNS TABLE(invoice_number text, invoice_created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  b public.bookings;
  t public.tenants;
  v_num text;
  v_at timestamptz := now();
BEGIN
  IF v_tenant IS NULL OR public.current_tenant_role() NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id AND current_tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Course introuvable' USING ERRCODE = 'P0002'; END IF;

  IF b.invoice_number LIKE 'FAC-%' THEN
    RETURN QUERY SELECT b.invoice_number, b.invoice_created_at;
    RETURN;
  END IF;

  IF b.mission_status IS DISTINCT FROM 'completed'
     OR b.status IN ('cancelled_no_refund', 'cancelled_pending_refund', 'cancelled_refunded', 'refund_failed', 'no_show') THEN
    RAISE EXCEPTION 'Course non facturable : elle doit être terminée' USING ERRCODE = '22023';
  END IF;
  -- Même règle que _shared/invoiceable.ts : transfert à prix kilométrique non validé.
  IF b.pricing_mode = 'direct' AND b.booking_type = 'transfer' AND coalesce(b.distance_km, 0) > 0 THEN
    RAISE EXCEPTION 'Prix au kilomètre non validé : valider le montant avant la facture' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO t FROM public.tenants WHERE id = v_tenant;
  IF coalesce(t.address_line, '') = '' OR coalesce(t.postal_code, '') = '' OR coalesce(t.city, '') = '' THEN
    RAISE EXCEPTION 'Adresse de l''entreprise manquante : compléter les Réglages' USING ERRCODE = '22023';
  END IF;

  v_num := public.next_invoice_number(v_tenant, extract(year FROM v_at AT TIME ZONE 'Europe/Paris')::int);
  UPDATE public.bookings SET invoice_number = v_num, invoice_created_at = v_at WHERE id = b.id;
  RETURN QUERY SELECT v_num, v_at;
END $$;

REVOKE EXECUTE ON FUNCTION public.assign_invoice_number(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_invoice_number(uuid) TO authenticated;

-- Le compteur ne se consomme plus que par assign_invoice_number.
REVOKE EXECUTE ON FUNCTION public.next_invoice_number(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid, int) TO service_role;
