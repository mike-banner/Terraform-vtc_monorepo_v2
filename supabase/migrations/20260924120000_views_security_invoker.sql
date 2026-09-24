-- Phase 10 — Lint Supabase ERROR `security_definer_view` (8 vues).
--
-- Ces vues ont été créées sans `security_invoker`, elles s'exécutent donc avec
-- les droits de leur propriétaire : la RLS des tables sous-jacentes ne s'y
-- applique pas, alors qu'elles sont en GRANT SELECT TO authenticated.
--
-- Vérification des appelants avant bascule :
--   - admin_tenants_overview, admin_monthly_summary, admin_bookings_full_view,
--     onboarding_admin_view : lues via createAdminClient() (service_role, qui
--     contourne la RLS de toute façon) → bascule sans impact fonctionnel.
--   - tenant_accounting_ledger, tenant_dashboard_kpi : sur financial_movements,
--     couverte par la policy `finance_select_isolated` (tenant_id = current_tenant_id()).
--   - driver_ratings : sur bookings + vehicles, couvertes par `bookings_select_isolation`
--     et `vehicles_tenant_isolation`.
--   - bookings_stuck_pending_refund : aucun appelant applicatif (vue d'ops).

ALTER VIEW public.admin_tenants_overview        SET (security_invoker = true);
ALTER VIEW public.admin_monthly_summary         SET (security_invoker = true);
ALTER VIEW public.admin_bookings_full_view      SET (security_invoker = true);
ALTER VIEW public.onboarding_admin_view         SET (security_invoker = true);
ALTER VIEW public.tenant_dashboard_kpi          SET (security_invoker = true);
ALTER VIEW public.driver_ratings                SET (security_invoker = true);
ALTER VIEW public.bookings_stuck_pending_refund SET (security_invoker = true);
ALTER VIEW public.tenant_accounting_ledger      SET (security_invoker = true);

-- Lint ERROR `auth_users_exposed` : onboarding_admin_view expose auth.users au rôle anon.
-- Elle n'est lue que par /admin/onboardings via service_role.
REVOKE ALL ON TABLE public.onboarding_admin_view FROM anon;
