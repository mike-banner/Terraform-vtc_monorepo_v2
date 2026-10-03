-- Le grand livre annuel comptait les mois en UTC alors que le détail mensuel les bornait en Europe/Paris :
-- un mouvement du 31 à 23h30 UTC tombait dans deux mois différents selon l'écran. La vue passe en heure de Paris.
CREATE OR REPLACE VIEW public.tenant_accounting_ledger AS
SELECT
    tenant_id,
    EXTRACT(YEAR FROM created_at AT TIME ZONE 'Europe/Paris')::int AS year,
    EXTRACT(MONTH FROM created_at AT TIME ZONE 'Europe/Paris')::int AS month,
    SUM(CASE WHEN movement_type = 'payment' THEN gross_amount ELSE -gross_amount END) AS gross_revenue,
    SUM(CASE WHEN movement_type = 'payment' THEN net_amount ELSE -net_amount END) AS net_revenue,
    SUM(CASE WHEN movement_type = 'payment' THEN vat_amount ELSE -vat_amount END) AS vat_collected,
    SUM(CASE WHEN movement_type = 'payment' THEN platform_commission_amount ELSE -platform_commission_amount END) AS platform_fees,
    SUM(CASE WHEN movement_type = 'payment' THEN driver_commission_amount ELSE -driver_commission_amount END) AS driver_commissions,
    COUNT(DISTINCT booking_id) AS booking_count
FROM public.financial_movements
GROUP BY tenant_id, 2, 3;

ALTER VIEW public.tenant_accounting_ledger SET (security_invoker = true);
