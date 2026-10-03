-- Avoirs AV- (D-03) : table immuable, séquence par tenant et année, écriture au grand livre (ADR-013).

CREATE TABLE public.credit_note_sequences (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  year int NOT NULL,
  last_seq int NOT NULL,
  PRIMARY KEY (tenant_id, year)
);

CREATE TABLE public.credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  booking_id uuid NOT NULL REFERENCES public.bookings(id),
  number text NOT NULL,
  invoice_number text NOT NULL,
  amount_ttc numeric(10,2) NOT NULL CHECK (amount_ttc > 0),
  amount_ht numeric(10,2) NOT NULL,
  vat_amount numeric(10,2) NOT NULL,
  reason text NOT NULL CHECK (char_length(trim(reason)) BETWEEN 1 AND 500),
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  UNIQUE (tenant_id, number)
);
CREATE INDEX credit_notes_booking_idx ON public.credit_notes (booking_id);

ALTER TABLE public.credit_note_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.credit_note_sequences FROM anon, authenticated;
REVOKE ALL ON public.credit_notes FROM anon, authenticated;
GRANT SELECT ON public.credit_notes TO authenticated;

CREATE POLICY credit_notes_select ON public.credit_notes FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_tenant_role() IN ('owner', 'manager'));

CREATE FUNCTION public.prevent_credit_note_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Un avoir émis ne se modifie pas';
END $$;
CREATE TRIGGER trg_prevent_credit_note_change BEFORE UPDATE OR DELETE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_credit_note_change();
REVOKE EXECUTE ON FUNCTION public.prevent_credit_note_change() FROM PUBLIC, anon, authenticated;

-- Reste à créditer : seule source du calcul, lue aussi par le navigateur (aucun calcul côté client).
CREATE FUNCTION public.credit_note_remaining(p_booking_id uuid) RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  b public.bookings;
BEGIN
  IF v_tenant IS NULL OR public.current_tenant_role() NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id AND current_tenant_id = v_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'Course introuvable' USING ERRCODE = 'P0002'; END IF;
  IF b.invoice_number IS NULL OR b.invoice_number NOT LIKE 'FAC-%' THEN
    RAISE EXCEPTION 'Facture requise' USING ERRCODE = '22023';
  END IF;
  RETURN b.total_amount - coalesce((SELECT sum(c.amount_ttc) FROM public.credit_notes c WHERE c.booking_id = p_booking_id), 0);
END $$;

CREATE FUNCTION public.issue_credit_note(p_booking_id uuid, p_amount_ttc numeric, p_reason text)
RETURNS TABLE(credit_note_id uuid, number text, payment_intent_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  b public.bookings;
  v_reason text := trim(coalesce(p_reason, ''));
  v_vat numeric;
  v_year int;
  v_seq int;
  v_number text;
  v_id uuid := gen_random_uuid();
BEGIN
  IF v_tenant IS NULL OR public.current_tenant_role() NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id AND current_tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Course introuvable' USING ERRCODE = 'P0002'; END IF;
  IF b.invoice_number IS NULL OR b.invoice_number NOT LIKE 'FAC-%' THEN
    RAISE EXCEPTION 'Facture requise' USING ERRCODE = '22023';
  END IF;
  IF p_amount_ttc IS NULL OR p_amount_ttc <= 0 THEN
    RAISE EXCEPTION 'Montant invalide' USING ERRCODE = '22023';
  END IF;
  IF v_reason = '' OR char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'Motif requis (500 caractères maximum)' USING ERRCODE = '22023';
  END IF;
  -- Même formule que credit_note_remaining, sous le verrou de la course.
  IF p_amount_ttc > public.credit_note_remaining(p_booking_id) THEN
    RAISE EXCEPTION 'Montant supérieur au reste à créditer' USING ERRCODE = '22023';
  END IF;

  v_vat := round(p_amount_ttc * coalesce(b.vat_amount, 0) / nullif(b.total_amount, 0), 2);
  v_year := extract(year FROM now() AT TIME ZONE 'Europe/Paris')::int;
  INSERT INTO public.credit_note_sequences AS s (tenant_id, year, last_seq) VALUES (v_tenant, v_year, 1)
    ON CONFLICT (tenant_id, year) DO UPDATE SET last_seq = s.last_seq + 1
    RETURNING s.last_seq INTO v_seq;
  v_number := format('AV-%s-%s', v_year, lpad(v_seq::text, 4, '0'));

  INSERT INTO public.credit_notes (id, tenant_id, booking_id, number, invoice_number, amount_ttc, amount_ht, vat_amount,
    reason, created_by)
  VALUES (v_id, v_tenant, b.id, v_number, b.invoice_number, p_amount_ttc, p_amount_ttc - coalesce(v_vat, 0),
    coalesce(v_vat, 0), v_reason, auth.uid());

  -- p_payment_intent NULL : l'index unique (PI, type, refund id) refuserait un second refund sur le même PI.
  PERFORM public.ledger_insert_refund(b.id, p_amount_ttc, NULL, 'credit_note:' || v_id, NULL);

  RETURN QUERY SELECT v_id, v_number, b.stripe_payment_intent_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.credit_note_remaining(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.issue_credit_note(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_note_remaining(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_credit_note(uuid, numeric, text) TO authenticated;

-- Storage : seul service_role dépose dans le bucket des pièces comptables.
DROP POLICY "invoices_service_insert" ON storage.objects;
CREATE POLICY "invoices_service_insert" ON storage.objects FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'invoices');

-- Journal d'e-mails : avoirs et confirmations de réservation.
ALTER TABLE public.email_logs DROP CONSTRAINT email_logs_email_type_check;
ALTER TABLE public.email_logs ADD CONSTRAINT email_logs_email_type_check
  CHECK (email_type IN ('devis', 'invoice', 'credit_note', 'booking_confirmation'));
