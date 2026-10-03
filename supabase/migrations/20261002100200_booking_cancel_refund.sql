-- Phase 14.1 : annulation d'une course avec remboursement selon la politique du tenant.
-- Tout le calcul (pourcentage, montant) est ici, jamais côté client. Le grand livre n'a qu'un point
-- d'entrée pour les remboursements : ledger_insert_refund (ADR-013), appelé par record_booking_refund.

ALTER TABLE public.bookings
  ADD COLUMN refund_amount numeric(10,2),
  ADD COLUMN refund_rate numeric(5,4) CHECK (refund_rate IS NULL OR refund_rate BETWEEN 0 AND 1),
  ADD COLUMN cancellation_note text CHECK (cancellation_note IS NULL OR char_length(cancellation_note) <= 500),
  ADD COLUMN refund_attempts integer NOT NULL DEFAULT 0;

INSERT INTO public.booking_status_transitions (from_status, to_status) VALUES ('paid', 'cancelled_no_refund')
  ON CONFLICT DO NOTHING;

-- Pourcentage remboursé pour un cas donné. Interne : aucun client ne l'appelle.
CREATE FUNCTION public.cancellation_refund_rate(b public.bookings, p_case text, p_rate numeric)
RETURNS numeric LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE
  pol public.cancellation_policies;
  v_hours numeric;
  v_rate numeric;
BEGIN
  IF p_rate IS NOT NULL AND p_rate NOT BETWEEN 0 AND 1 THEN
    RAISE EXCEPTION 'Taux invalide' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO pol FROM public.cancellation_policies WHERE id = b.cancellation_policy_id;
  IF NOT FOUND THEN
    SELECT * INTO pol FROM public.cancellation_policies WHERE tenant_id = b.current_tenant_id AND active;
  END IF;
  IF pol.id IS NULL THEN
    RAISE EXCEPTION 'Politique d''annulation introuvable' USING ERRCODE = '22023';
  END IF;
  IF p_case = 'client' THEN
    v_hours := extract(epoch FROM b.pickup_time - now()) / 3600;
    v_rate := CASE WHEN v_hours >= pol.hours_before_full_refund THEN 1
                   WHEN v_hours >= pol.hours_before_partial_refund THEN pol.partial_refund_rate
                   ELSE 0 END;
  ELSIF p_case = 'no_show' THEN
    v_rate := coalesce(p_rate, pol.no_show_refund_rate);
  ELSIF p_case = 'driver_fault' THEN
    v_rate := pol.driver_fault_refund_rate;
  ELSIF p_case = 'other' THEN
    v_rate := p_rate;
  ELSE
    RAISE EXCEPTION 'Cas d''annulation invalide' USING ERRCODE = '22023';
  END IF;
  RETURN round(v_rate, 4);
END $$;

-- Aperçu : une ligne par cas autorisé au rôle (4 pour owner/manager, 2 pour le chauffeur).
CREATE FUNCTION public.cancellation_preview(p_booking_id uuid, p_rate numeric DEFAULT NULL)
RETURNS TABLE(case_code text, rate numeric, amount numeric, paid boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_role public.tenant_role := public.current_tenant_role();
  v_tenant uuid := public.current_tenant_id();
  b public.bookings; v_case text; v_r numeric;
BEGIN
  IF v_tenant IS NULL OR v_role IS NULL OR v_role NOT IN ('owner','manager','driver') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id AND current_tenant_id = v_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'Course introuvable' USING ERRCODE = 'P0002'; END IF;
  IF v_role = 'driver' AND b.driver_id IS DISTINCT FROM
     (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid() AND d.tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  FOR v_case IN SELECT unnest(CASE WHEN v_role = 'driver' THEN ARRAY['client','driver_fault']
                                   ELSE ARRAY['client','no_show','driver_fault','other'] END) LOOP
    v_r := public.cancellation_refund_rate(b, v_case, p_rate);
    RETURN QUERY SELECT v_case, v_r,
      CASE WHEN b.status <> 'paid' THEN 0::numeric
           WHEN v_r IS NULL THEN NULL::numeric
           ELSE round(b.total_amount * v_r, 2) END,
      b.status = 'paid';
  END LOOP;
END $$;

CREATE FUNCTION public.cancel_booking(p_booking_id uuid, p_case text, p_rate numeric, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_role public.tenant_role := public.current_tenant_role();
  v_tenant uuid := public.current_tenant_id();
  b public.bookings;
  v_note text := left(trim(coalesce(p_note, '')), 500);
  v_rate numeric; v_amount numeric(10,2); v_new public.booking_status;
  v_paid boolean;
BEGIN
  IF v_tenant IS NULL OR v_role IS NULL OR v_role NOT IN ('owner','manager','driver') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id AND current_tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Course introuvable' USING ERRCODE = 'P0002'; END IF;
  IF v_role = 'driver' THEN
    IF b.driver_id IS DISTINCT FROM
       (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid() AND d.tenant_id = v_tenant) THEN
      RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    IF p_case IS NULL OR p_case NOT IN ('client','driver_fault') THEN
      RAISE EXCEPTION 'Cas réservé au propriétaire ou au gestionnaire' USING ERRCODE = '22023';
    END IF;
    IF b.pickup_time <= now() THEN
      RAISE EXCEPTION 'Annulation après l''heure : réservée au propriétaire ou au gestionnaire' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_case IS NULL OR p_case NOT IN ('client','no_show','driver_fault','other') THEN
    RAISE EXCEPTION 'Cas d''annulation invalide' USING ERRCODE = '22023';
  END IF;
  -- Idempotence : déjà annulée -> même réponse, aucune écriture.
  IF b.status IN ('cancelled_no_refund','cancelled_pending_refund','cancelled_refunded','refund_failed') THEN
    RETURN jsonb_build_object('status', b.status, 'refund_amount', b.refund_amount,
      'payment_intent_id', b.stripe_payment_intent_id, 'attempt', b.refund_attempts);
  END IF;
  IF coalesce(b.mission_status::text, '') NOT IN ('to_validate','not_started')
     OR b.status NOT IN ('pending','accepted','accepted_pending_payment','paid') THEN
    RAISE EXCEPTION 'Action impossible : mission déjà démarrée ou terminée' USING ERRCODE = '22023';
  END IF;
  IF v_note = '' THEN RAISE EXCEPTION 'Note obligatoire' USING ERRCODE = '22023'; END IF;
  v_rate := public.cancellation_refund_rate(b, p_case, p_rate);
  IF v_rate IS NULL THEN RAISE EXCEPTION 'Pourcentage requis' USING ERRCODE = '22023'; END IF;
  v_paid := b.status = 'paid';
  v_amount := CASE WHEN v_paid THEN round(b.total_amount * v_rate, 2) ELSE 0 END;
  IF NOT v_paid OR v_amount = 0 THEN
    v_new := 'cancelled_no_refund';
  ELSIF b.stripe_payment_intent_id IS NULL THEN
    RAISE EXCEPTION 'Paiement sans référence Stripe : remboursement manuel requis' USING ERRCODE = '22023';
  ELSE
    v_new := 'cancelled_pending_refund';
  END IF;
  UPDATE public.bookings SET
    status = v_new,
    cancelled_at = now() AT TIME ZONE 'UTC',
    cancellation_reason = p_case::public.cancellation_reason_enum,
    cancellation_initiator = v_role::text,
    cancellation_note = v_note,
    refund_rate = CASE WHEN v_paid THEN v_rate END,
    refund_amount = CASE WHEN v_paid THEN v_amount END,
    mission_note = CASE WHEN coalesce(mission_note, '') = '' THEN '' ELSE mission_note || E'\n' END
                   || '[annulation] initiateur=' || v_role::text || ' | motif=' || v_note
  WHERE id = b.id;
  RETURN jsonb_build_object('status', v_new, 'refund_amount', CASE WHEN v_paid THEN v_amount END,
    'payment_intent_id', b.stripe_payment_intent_id, 'attempt', b.refund_attempts);
END $$;

-- Seul point d'écriture des remboursements au grand livre (ADR-013). Aucun rôle client, service_role compris.
CREATE FUNCTION public.ledger_insert_refund(p_booking_id uuid, p_gross numeric, p_stripe_refund_id text,
  p_event text, p_payment_intent text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  b public.bookings; v_vat numeric;
BEGIN
  IF p_gross IS NULL OR p_gross <= 0 THEN
    RAISE EXCEPTION 'Montant invalide' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Course introuvable' USING ERRCODE = 'P0002'; END IF;
  IF (SELECT coalesce(sum(gross_amount), 0) FROM public.financial_movements
       WHERE booking_id = p_booking_id AND movement_type = 'refund') + p_gross
     > (SELECT coalesce(sum(gross_amount), 0) FROM public.financial_movements
         WHERE booking_id = p_booking_id AND movement_type = 'payment') THEN
    RAISE EXCEPTION 'Remboursement supérieur aux encaissements' USING ERRCODE = '22023';
  END IF;
  v_vat := CASE WHEN b.total_amount > 0 THEN round(p_gross * coalesce(b.vat_amount, 0) / b.total_amount, 2) ELSE 0 END;
  INSERT INTO public.financial_movements (booking_id, tenant_id, stripe_payment_intent_id, stripe_refund_id,
    movement_type, direction, gross_amount, net_amount, vat_amount, refund_ratio, created_by_event)
  VALUES (b.id, b.current_tenant_id, p_payment_intent, p_stripe_refund_id,
    'refund', 'debit', p_gross, p_gross - v_vat, v_vat, round(p_gross / b.total_amount, 4), p_event);
END $$;

CREATE FUNCTION public.record_booking_refund(p_booking_id uuid, p_stripe_refund_id text, p_amount numeric)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  b public.bookings;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Course introuvable' USING ERRCODE = 'P0002'; END IF;
  IF b.status = 'cancelled_refunded' AND EXISTS (
       SELECT 1 FROM public.financial_movements
        WHERE booking_id = b.id AND movement_type = 'refund' AND stripe_refund_id = p_stripe_refund_id) THEN
    RETURN 'cancelled_refunded';
  END IF;
  IF b.status <> 'cancelled_pending_refund' THEN
    RAISE EXCEPTION 'Statut inattendu pour un remboursement : %', b.status USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_stripe_refund_id, '') = '' THEN
    RAISE EXCEPTION 'Référence de remboursement requise' USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR b.refund_amount IS NULL OR abs(p_amount - b.refund_amount) > 0.01 THEN
    RAISE EXCEPTION 'Montant remboursé incohérent' USING ERRCODE = '22023';
  END IF;
  BEGIN
    PERFORM public.ledger_insert_refund(b.id, b.refund_amount, p_stripe_refund_id, 'stripe_refund',
      b.stripe_payment_intent_id);
  EXCEPTION WHEN unique_violation THEN
    NULL; -- même remboursement déjà inscrit : succès
  END;
  UPDATE public.bookings SET status = 'cancelled_refunded' WHERE id = b.id;
  RETURN 'cancelled_refunded';
END $$;

CREATE FUNCTION public.mark_refund_failed(p_booking_id uuid, p_message text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  b public.bookings;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Course introuvable' USING ERRCODE = 'P0002'; END IF;
  IF b.status <> 'cancelled_pending_refund' THEN RETURN b.status::text; END IF;
  UPDATE public.bookings SET
    status = 'refund_failed',
    mission_note = CASE WHEN coalesce(mission_note, '') = '' THEN '' ELSE mission_note || E'\n' END
                   || '[remboursement] échec : ' || left(coalesce(p_message, ''), 200)
  WHERE id = b.id;
  RETURN 'refund_failed';
END $$;

CREATE FUNCTION public.retry_refund(p_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
  IF b.status <> 'refund_failed' THEN
    RAISE EXCEPTION 'Remboursement non en échec' USING ERRCODE = '22023';
  END IF;
  UPDATE public.bookings SET status = 'cancelled_pending_refund', refund_attempts = refund_attempts + 1
   WHERE id = b.id RETURNING * INTO b;
  RETURN jsonb_build_object('status', b.status, 'refund_amount', b.refund_amount,
    'payment_intent_id', b.stripe_payment_intent_id, 'attempt', b.refund_attempts);
END $$;

-- driver_cancel_booking : corps inchangé, plus le refus des courses payées (elles passent par cancel_booking).
CREATE OR REPLACE FUNCTION public.driver_cancel_booking(p_booking_id uuid, p_reason text)
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
  IF b.status = 'paid' THEN
    RAISE EXCEPTION 'Course payée : utiliser Annuler avec remboursement' USING ERRCODE = '22023';
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

-- Droits : PUBLIC retiré aussi (anon/authenticated héritent de PUBLIC par défaut).
REVOKE EXECUTE ON FUNCTION public.cancellation_refund_rate(public.bookings, text, numeric) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.ledger_insert_refund(uuid, numeric, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.cancellation_preview(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_booking(uuid, text, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.retry_refund(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_booking_refund(uuid, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_refund_failed(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.driver_cancel_booking(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancellation_preview(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retry_refund(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_cancel_booking(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_booking_refund(uuid, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_refund_failed(uuid, text) TO service_role;
