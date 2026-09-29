-- Phase 13 : rôle tenant de l'appelant, pour les policies RLS par rôle.
--
-- Calque exact de current_tenant_id() : SQL STABLE, search_path figé, SANS
-- SECURITY DEFINER. profiles_select_own laisse chacun lire sa propre ligne,
-- aucune élévation n'est nécessaire ; une fonction DEFINER ouverte à PUBLIC
-- relancerait le WARN « anon can execute SECURITY DEFINER » du linter.
-- EXECUTE reste accordé à PUBLIC : les policies s'évaluent sous le rôle
-- appelant, anon compris (auth.uid() NULL -> la fonction renvoie NULL).

CREATE OR REPLACE FUNCTION public.current_tenant_role()
RETURNS public.tenant_role
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  select tenant_role
  from public.profiles
  where id = auth.uid()
$$;
