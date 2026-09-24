-- Phase 10 — Fuite inter-tenant sur get_fiscal_summary.
--
-- La fonction est SECURITY DEFINER, GRANT EXECUTE TO authenticated, et prend le
-- tenant en paramètre sans jamais vérifier qu'il s'agit de celui du caller :
-- n'importe quel compte connecté pouvait lire le CA annuel de n'importe quelle
-- entreprise via /rest/v1/rpc/get_fiscal_summary. Passer la vue sous-jacente en
-- security_invoker ne suffit pas, la fonction restant DEFINER.
--
-- On garde SECURITY DEFINER (la fonction doit lire financial_movements agrégés)
-- mais on contraint t_id au tenant du caller. service_role continue d'appeler
-- librement : auth.uid() est NULL et current_tenant_id() aussi, d'où le court-circuit.

CREATE OR REPLACE FUNCTION public.get_fiscal_summary(t_id uuid, f_year int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result jsonb;
BEGIN
    IF auth.uid() IS NOT NULL AND t_id IS DISTINCT FROM public.current_tenant_id() THEN
        RAISE EXCEPTION 'Access denied: tenant mismatch' USING ERRCODE = '42501';
    END IF;

    SELECT jsonb_build_object(
        'year', f_year,
        'total_gross', COALESCE(SUM(gross_revenue), 0),
        'total_net', COALESCE(SUM(net_revenue), 0),
        'total_vat', COALESCE(SUM(vat_collected), 0),
        'months', COALESCE(jsonb_agg(
            jsonb_build_object(
                'month', month,
                'gross', gross_revenue,
                'net', net_revenue,
                'bookings', booking_count
            ) ORDER BY month ASC
        ), '[]'::jsonb)
    ) INTO result
    FROM public.tenant_accounting_ledger
    WHERE tenant_id = t_id AND year = f_year;

    RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_fiscal_summary(uuid, int) FROM anon;
