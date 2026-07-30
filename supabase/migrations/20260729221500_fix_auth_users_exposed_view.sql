-- Migration : 20260729221500_fix_auth_users_exposed_view.sql
-- Fix Supabase Security Advisor alert: auth_users_exposed
-- Revoke public PostgREST API access on admin views exposing auth.users or internal system data

-- 1. onboarding_admin_view (Joins auth.users)
REVOKE ALL ON TABLE public.onboarding_admin_view FROM anon, authenticated, public;
GRANT SELECT ON TABLE public.onboarding_admin_view TO service_role;

-- 2. admin_bookings_full_view
REVOKE ALL ON TABLE public.admin_bookings_full_view FROM anon, authenticated, public;
GRANT SELECT ON TABLE public.admin_bookings_full_view TO service_role;

-- 3. admin_tenants_overview
REVOKE ALL ON TABLE public.admin_tenants_overview FROM anon, authenticated, public;
GRANT SELECT ON TABLE public.admin_tenants_overview TO service_role;

-- 4. admin_monthly_summary
REVOKE ALL ON TABLE public.admin_monthly_summary FROM anon, authenticated, public;
GRANT SELECT ON TABLE public.admin_monthly_summary TO service_role;
