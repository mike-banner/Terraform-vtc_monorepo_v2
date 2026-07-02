-- 20260702120000_custom_access_token_hook.sql
-- Custom Access Token Hook : injecte tenant_role, tenant_id et platform_role
-- dans le JWT à l'émission, pour que le middleware backoffice route 100%
-- depuis le token sans requête profiles séquentielle (D-03/D-04).

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claims jsonb;
  user_tenant_role public.tenant_role;
  user_tenant_id uuid;
  user_platform_role public.platform_role;
BEGIN
  SELECT tenant_role, tenant_id, platform_role
  INTO user_tenant_role, user_tenant_id, user_platform_role
  FROM public.profiles
  WHERE id = (event->>'user_id')::uuid;

  claims := event->'claims';

  claims := jsonb_set(claims, '{tenant_role}', COALESCE(to_jsonb(user_tenant_role), 'null'::jsonb), true);
  claims := jsonb_set(claims, '{tenant_id}', COALESCE(to_jsonb(user_tenant_id), 'null'::jsonb), true);
  claims := jsonb_set(claims, '{platform_role}', COALESCE(to_jsonb(user_platform_role), 'null'::jsonb), true);

  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
END;
$$;

-- Le hook s'exécute dans le rôle de l'auth server (supabase_auth_admin), jamais
-- côté utilisateur : RLS reste active sur profiles, on n'accorde qu'un SELECT
-- ciblé au rôle système, aucun accès n'est ouvert à anon/authenticated.
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
GRANT SELECT ON TABLE public.profiles TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;
