-- Phase 10 — Lint Supabase : `function_search_path_mutable` (WARN) et
-- `anon_security_definer_function_executable` / `authenticated_...` (WARN).

-- 1. search_path figé. Sans lui, un appelant peut détourner la résolution des
--    noms non qualifiés — critique sur les fonctions SECURITY DEFINER.
ALTER FUNCTION public.update_platform_settings_updated_at() SET search_path = public;
ALTER FUNCTION public.handle_driver_verification_email()    SET search_path = public;
ALTER FUNCTION public.prevent_late_cancellation()           SET search_path = public;
ALTER FUNCTION public.sync_tenant_vat_config()              SET search_path = public;
ALTER FUNCTION public.set_tenant_vat_on_insert()            SET search_path = public;
-- get_fiscal_summary : traité dans 20260924120100.

-- 2. Fonctions de trigger : jamais destinées à un appel RPC direct. Les révoquer
--    n'affecte pas leur exécution par le trigger (il tourne sous le propriétaire).
REVOKE EXECUTE ON FUNCTION public.auto_create_financial_movement()   FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_driver_verification_email() FROM anon, authenticated;

-- 3. Fonctions appelées uniquement en service_role (edge functions / createAdminClient).
REVOKE EXECUTE ON FUNCTION public.approve_onboarding_tx(uuid)         FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.initiate_refund(uuid, text)         FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.next_invoice_number(uuid, int)      FROM anon, authenticated;

-- 4. Conservées pour `authenticated`, anon révoqué :
--    delete_tenant_account() est appelée par l'edge function delete-tenant-account
--    avec le JWT de l'utilisateur (le rôle effectif est `authenticated`).
REVOKE EXECUTE ON FUNCTION public.delete_tenant_account() FROM anon;

-- 5. NON TOUCHÉE : get_available_vehicles(uuid) est appelée par les tunnels publics
--    de vtc-websites avec la clé anon. La révoquer casserait les 4 tunnels.
--    Le lint restera en WARN sur cette fonction, c'est intentionnel.
