-- Phase 16 (D-02 b, c) : totaux du grand livre calculés côté serveur, en lecture seule.
-- SECURITY INVOKER : la RLS de financial_movements et la vue security_invoker s'appliquent.

CREATE FUNCTION public.tenant_ledger_year(p_year int)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_role public.tenant_role := public.current_tenant_role();
  v_months jsonb;
BEGIN
  IF v_tenant IS NULL OR v_role IS NULL OR v_role NOT IN ('owner','manager') THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_agg(jsonb_build_object('month', m.month,
           'gross', coalesce(l.gross_revenue, 0), 'net', coalesce(l.net_revenue, 0),
           'vat', coalesce(l.vat_collected, 0), 'count', coalesce(l.booking_count, 0)) ORDER BY m.month)
    INTO v_months
    FROM generate_series(1, 12) AS m(month)
    LEFT JOIN public.tenant_accounting_ledger l
      ON l.tenant_id = v_tenant AND l.year = p_year AND l.month = m.month;
  RETURN jsonb_build_object('months', v_months, 'totals', jsonb_build_object(
    'gross', (SELECT coalesce(sum((x->>'gross')::numeric), 0) FROM jsonb_array_elements(v_months) x),
    'net',   (SELECT coalesce(sum((x->>'net')::numeric), 0)   FROM jsonb_array_elements(v_months) x),
    'vat',   (SELECT coalesce(sum((x->>'vat')::numeric), 0)   FROM jsonb_array_elements(v_months) x),
    'count', (SELECT coalesce(sum((x->>'count')::numeric), 0) FROM jsonb_array_elements(v_months) x)));
END $$;

CREATE FUNCTION public.tenant_ledger_month(p_year int, p_month int, p_mode text DEFAULT 'all')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_role public.tenant_role := public.current_tenant_role();
  v_from timestamptz; v_to timestamptz; v_movements jsonb;
BEGIN
  IF v_tenant IS NULL OR v_role IS NULL OR v_role NOT IN ('owner','manager') THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('all','card','cash') OR p_month NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'Paramètres invalides' USING ERRCODE = '22023';
  END IF;
  v_from := make_timestamp(p_year, p_month, 1, 0, 0, 0) AT TIME ZONE 'Europe/Paris';
  v_to := (make_timestamp(p_year, p_month, 1, 0, 0, 0) + interval '1 month') AT TIME ZONE 'Europe/Paris';

  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC, t.id), '[]'::jsonb) INTO v_movements
  FROM (
    SELECT fm.id, fm.created_at, fm.movement_type,
           CASE WHEN fm.movement_type = 'payment' THEN fm.gross_amount ELSE -fm.gross_amount END AS signed_gross,
           CASE WHEN fm.movement_type = 'payment' THEN fm.net_amount ELSE -fm.net_amount END AS signed_net,
           CASE WHEN fm.movement_type = 'payment' THEN coalesce(fm.vat_amount, 0) ELSE -coalesce(fm.vat_amount, 0) END AS signed_vat,
           fm.booking_id, b.pickup_time, b.pickup_address, b.dropoff_address,
           b.payment_mode, b.status AS booking_status,
           coalesce(nullif(c.company_name, ''), nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), '')) AS customer_name,
           b.invoice_number,
           CASE WHEN fm.movement_type = 'refund' THEN
             (SELECT cn.number FROM public.credit_notes cn WHERE cn.booking_id = fm.booking_id ORDER BY cn.issued_at DESC LIMIT 1)
           END AS credit_note_number
      FROM public.financial_movements fm
      LEFT JOIN public.bookings b ON b.id = fm.booking_id
      LEFT JOIN public.customers c ON c.id = b.customer_id
     WHERE fm.tenant_id = v_tenant AND fm.created_at >= v_from AND fm.created_at < v_to
       AND (p_mode = 'all' OR b.payment_mode::text = p_mode)
  ) t;

  RETURN jsonb_build_object('movements', v_movements, 'totals', jsonb_build_object(
    'gross', (SELECT coalesce(sum((x->>'signed_gross')::numeric), 0) FROM jsonb_array_elements(v_movements) x),
    'net',   (SELECT coalesce(sum((x->>'signed_net')::numeric), 0)   FROM jsonb_array_elements(v_movements) x),
    'vat',   (SELECT coalesce(sum((x->>'signed_vat')::numeric), 0)   FROM jsonb_array_elements(v_movements) x),
    'count', (SELECT count(DISTINCT x->>'booking_id') FROM jsonb_array_elements(v_movements) x)));
END $$;

REVOKE EXECUTE ON FUNCTION public.tenant_ledger_year(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenant_ledger_year(int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.tenant_ledger_month(int, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenant_ledger_month(int, int, text) TO authenticated;
