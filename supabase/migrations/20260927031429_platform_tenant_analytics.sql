-- 20260927031429_platform_tenant_analytics.sql
--
-- Vue analytique de la plateforme (Phase 4.5) : volume et chiffre d'affaires par tenant
-- sur une période, pour l'écran Analytics d'apps/superadmin.
--
-- Agrégats calculés en base (règle du projet : aucun calcul financier côté client),
-- ligne de total comprise (GROUPING SETS : tenant_id NULL).
--
-- SECURITY INVOKER : la RLS de l'appelant s'applique (policies *_platform_admin_read sur
-- bookings, financial_movements et tenants). Le contrôle de rôle explicite évite qu'un
-- owner obtienne une « analytique plateforme » réduite à son propre tenant.
--
-- Sources :
--   - volume : bookings.created_at dans [p_from, p_to[, rattachées à current_tenant_id ;
--   - argent : financial_movements.created_at dans [p_from, p_to[. Encaissé = mouvements
--     payment/credit ; remboursé = refund/debit ; CA = encaissé - remboursé.
--     Les commissions (commission, commission_reversal) ne sont pas du CA tenant.

CREATE OR REPLACE FUNCTION public.platform_tenant_analytics(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (
  tenant_id        uuid,
  tenant_name      text,
  tenant_status    text,
  bookings_count   bigint,
  completed_count  bigint,
  cancelled_count  bigint,
  collected_gross  numeric,
  refunded_gross   numeric,
  revenue_gross    numeric,
  revenue_net      numeric,
  vat_collected    numeric
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND platform_role IN ('super_admin', 'platform_staff')
  ) THEN
    RAISE EXCEPTION 'platform_tenant_analytics: réservé aux administrateurs plateforme'
      USING ERRCODE = '42501';
  END IF;

  IF p_from IS NULL OR p_to IS NULL OR p_from >= p_to THEN
    RAISE EXCEPTION 'platform_tenant_analytics: période invalide' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH vol AS (
    SELECT b.current_tenant_id AS tid,
           count(*)                                              AS n,
           count(*) FILTER (WHERE b.mission_status = 'completed') AS n_completed,
           count(*) FILTER (WHERE b.status::text LIKE 'cancelled%') AS n_cancelled
    FROM bookings b
    WHERE b.created_at >= p_from AND b.created_at < p_to
    GROUP BY b.current_tenant_id
  ),
  money AS (
    SELECT f.tenant_id AS tid,
           coalesce(sum(f.gross_amount) FILTER (WHERE f.movement_type = 'payment' AND f.direction = 'credit'), 0) AS pay_gross,
           coalesce(sum(f.net_amount)   FILTER (WHERE f.movement_type = 'payment' AND f.direction = 'credit'), 0) AS pay_net,
           coalesce(sum(f.vat_amount)   FILTER (WHERE f.movement_type = 'payment' AND f.direction = 'credit'), 0) AS pay_vat,
           coalesce(sum(f.gross_amount) FILTER (WHERE f.movement_type = 'refund'  AND f.direction = 'debit'),  0) AS ref_gross,
           coalesce(sum(f.net_amount)   FILTER (WHERE f.movement_type = 'refund'  AND f.direction = 'debit'),  0) AS ref_net,
           coalesce(sum(f.vat_amount)   FILTER (WHERE f.movement_type = 'refund'  AND f.direction = 'debit'),  0) AS ref_vat
    FROM financial_movements f
    WHERE f.created_at >= p_from AND f.created_at < p_to
    GROUP BY f.tenant_id
  ),
  per_tenant AS (
    SELECT t.id, t.name, t.status::text AS status,
           coalesce(v.n, 0)           AS n,
           coalesce(v.n_completed, 0) AS n_completed,
           coalesce(v.n_cancelled, 0) AS n_cancelled,
           coalesce(m.pay_gross, 0)   AS pay_gross,
           coalesce(m.ref_gross, 0)   AS ref_gross,
           coalesce(m.pay_net, 0) - coalesce(m.ref_net, 0) AS net,
           coalesce(m.pay_vat, 0) - coalesce(m.ref_vat, 0) AS vat
    FROM tenants t
    LEFT JOIN vol v   ON v.tid = t.id
    LEFT JOIN money m ON m.tid = t.id
  )
  SELECT
    p.id,
    CASE WHEN GROUPING(p.id) = 1 THEN 'Total' ELSE max(p.name) END,
    CASE WHEN GROUPING(p.id) = 1 THEN NULL ELSE max(p.status) END,
    sum(p.n)::bigint,
    sum(p.n_completed)::bigint,
    sum(p.n_cancelled)::bigint,
    sum(p.pay_gross),
    sum(p.ref_gross),
    sum(p.pay_gross) - sum(p.ref_gross),
    sum(p.net),
    sum(p.vat)
  FROM per_tenant p
  GROUP BY GROUPING SETS ((p.id), ())
  ORDER BY GROUPING(p.id), sum(p.pay_gross) - sum(p.ref_gross) DESC, max(p.name);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.platform_tenant_analytics(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_tenant_analytics(timestamptz, timestamptz) TO authenticated;
