-- Phase 14.1 : politique d'annulation par tenant (D-05 à D-08).
-- Défaut : 24 h remboursement total / 2 h partiel à 50 % / non-présentation 0 % / faute chauffeur 100 %.
-- Chaque course reçoit la politique active de son tenant à sa création ; le propriétaire crée une nouvelle
-- version par update_cancellation_policy, jamais de modification d'une version existante.

-- Backfill des tenants existants.
INSERT INTO public.cancellation_policies (tenant_id, version, hours_before_full_refund, hours_before_partial_refund,
  partial_refund_rate, no_show_refund_rate, driver_fault_refund_rate, platform_fee_non_refundable, active)
SELECT t.id, coalesce((SELECT max(version) FROM public.cancellation_policies p WHERE p.tenant_id = t.id), 0) + 1,
  24, 2, 0.5, 0, 1, false, true
FROM public.tenants t
WHERE NOT EXISTS (SELECT 1 FROM public.cancellation_policies p WHERE p.tenant_id = t.id AND p.active);

ALTER TABLE public.cancellation_policies ALTER COLUMN tenant_id SET NOT NULL;

-- Politique par défaut pour chaque nouveau tenant.
CREATE FUNCTION public.create_default_cancellation_policy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.cancellation_policies (tenant_id, version, hours_before_full_refund, hours_before_partial_refund,
    partial_refund_rate, no_show_refund_rate, driver_fault_refund_rate, platform_fee_non_refundable, active)
  VALUES (NEW.id, 1, 24, 2, 0.5, 0, 1, false, true);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_default_cancellation_policy AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.create_default_cancellation_policy();

-- Rattachement de la politique active à chaque nouvelle course (hors règle 7 du lint, Q5).
CREATE FUNCTION public.attach_cancellation_policy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  NEW.cancellation_policy_id := coalesce(NEW.cancellation_policy_id,
    (SELECT id FROM public.cancellation_policies WHERE tenant_id = NEW.current_tenant_id AND active));
  RETURN NEW;
END $$;

CREATE TRIGGER trg_attach_cancellation_policy BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.attach_cancellation_policy();

-- Courses existantes (NULL -> valeur : permis par trg_prevent_policy_update).
UPDATE public.bookings b SET cancellation_policy_id = p.id
FROM public.cancellation_policies p
WHERE p.tenant_id = b.current_tenant_id AND p.active AND b.cancellation_policy_id IS NULL;

-- Lecture par les membres du tenant ; écriture uniquement par RPC.
CREATE POLICY cancellation_policies_select ON public.cancellation_policies FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
REVOKE ALL ON public.cancellation_policies FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.cancellation_policies FROM authenticated;

CREATE FUNCTION public.update_cancellation_policy(p_full_hours integer, p_partial_hours integer,
  p_partial_rate numeric, p_no_show_rate numeric, p_driver_fault_rate numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_fee boolean; v_id uuid;
BEGIN
  IF v_tenant IS NULL OR public.current_tenant_role() IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_full_hours IS NULL OR p_partial_hours IS NULL
     OR p_partial_hours < 0 OR p_partial_hours > p_full_hours OR p_full_hours > 720
     OR p_partial_rate IS NULL OR p_partial_rate NOT BETWEEN 0 AND 1
     OR p_no_show_rate IS NULL OR p_no_show_rate NOT BETWEEN 0 AND 1
     OR p_driver_fault_rate IS NULL OR p_driver_fault_rate NOT BETWEEN 0 AND 1 THEN
    RAISE EXCEPTION 'Politique invalide' USING ERRCODE = '22023';
  END IF;
  SELECT platform_fee_non_refundable INTO v_fee FROM public.cancellation_policies
   WHERE tenant_id = v_tenant AND active FOR UPDATE;
  UPDATE public.cancellation_policies SET active = false WHERE tenant_id = v_tenant AND active;
  INSERT INTO public.cancellation_policies (tenant_id, version, hours_before_full_refund, hours_before_partial_refund,
    partial_refund_rate, no_show_refund_rate, driver_fault_refund_rate, platform_fee_non_refundable, active)
  VALUES (v_tenant,
    coalesce((SELECT max(version) FROM public.cancellation_policies WHERE tenant_id = v_tenant), 0) + 1,
    p_full_hours, p_partial_hours, p_partial_rate, p_no_show_rate, p_driver_fault_rate, coalesce(v_fee, false), true)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.create_default_cancellation_policy() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.attach_cancellation_policy() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_cancellation_policy(integer, integer, numeric, numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_cancellation_policy(integer, integer, numeric, numeric, numeric) TO authenticated;
