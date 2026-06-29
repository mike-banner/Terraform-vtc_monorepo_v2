-- 20260331230000_fiscal_ledger.sql
-- Create a comprehensive ledger view for accounting and fiscal reporting

CREATE OR REPLACE VIEW "public"."tenant_accounting_ledger" AS
SELECT
    tenant_id,
    EXTRACT(YEAR FROM created_at)::int AS year,
    EXTRACT(MONTH FROM created_at)::int AS month,
    SUM(CASE WHEN movement_type = 'payment' THEN gross_amount ELSE -gross_amount END) AS gross_revenue,
    SUM(CASE WHEN movement_type = 'payment' THEN net_amount ELSE -net_amount END) AS net_revenue,
    SUM(CASE WHEN movement_type = 'payment' THEN vat_amount ELSE -vat_amount END) AS vat_collected,
    SUM(CASE WHEN movement_type = 'payment' THEN platform_commission_amount ELSE -platform_commission_amount END) AS platform_fees,
    SUM(CASE WHEN movement_type = 'payment' THEN driver_commission_amount ELSE -driver_commission_amount END) AS driver_commissions,
    COUNT(DISTINCT booking_id) AS booking_count
FROM financial_movements
GROUP BY tenant_id, year, month;

-- Set permissions
GRANT SELECT ON TABLE "public"."tenant_accounting_ledger" TO "authenticated";
GRANT SELECT ON TABLE "public"."tenant_accounting_ledger" TO "service_role";

-- Helper function for annual summaries
CREATE OR REPLACE FUNCTION get_fiscal_summary(t_id uuid, f_year int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
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

-- Set permissions
GRANT EXECUTE ON FUNCTION get_fiscal_summary(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_fiscal_summary(uuid, int) TO service_role;
