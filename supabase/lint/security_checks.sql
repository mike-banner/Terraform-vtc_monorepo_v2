-- Lint sécurité schéma — exécuté en CI sur une base locale reconstruite depuis
-- supabase/migrations/. Reproduit les ERROR du linter Supabase qui nous ont
-- mordu en Phase 10, de façon déterministe et sans accès au projet distant.
--
-- Pour neutraliser une violation assumée, l'ajouter à l'allowlist correspondante
-- AVEC un commentaire justifiant pourquoi.

\set ON_ERROR_STOP on

DO $$
DECLARE
  violations text[] := '{}';
  r record;

  -- Vues de public autorisées à rester en SECURITY DEFINER. Vide : aucune ne l'est.
  allowed_definer_views text[] := ARRAY[]::text[];

  -- Tables de public autorisées à tourner sans RLS.
  allowed_no_rls text[] := ARRAY[]::text[];

  -- Fonctions SECURITY DEFINER autorisées sans search_path figé.
  allowed_mutable_search_path text[] := ARRAY[]::text[];
BEGIN
  -- 1. Vue SECURITY DEFINER : la RLS des tables sources ne s'applique pas.
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'v'
      AND NOT COALESCE(
        (SELECT option_value::boolean
         FROM pg_options_to_table(c.reloptions)
         WHERE option_name = 'security_invoker'),
        false)
      AND NOT (c.relname = ANY (allowed_definer_views))
  LOOP
    violations := violations || format('view %I is SECURITY DEFINER (add security_invoker = true)', r.relname);
  END LOOP;

  -- 2. Table exposée via PostgREST sans RLS.
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
      AND NOT (c.relname = ANY (allowed_no_rls))
  LOOP
    violations := violations || format('table %I has no RLS enabled', r.relname);
  END LOOP;

  -- 3. SECURITY DEFINER sans search_path : résolution de noms détournable.
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) AS cfg
        WHERE cfg LIKE 'search\_path=%'
      )
      AND NOT (p.proname = ANY (allowed_mutable_search_path))
  LOOP
    violations := violations || format('function %I(%s) is SECURITY DEFINER without a fixed search_path', r.proname, r.args);
  END LOOP;

  IF array_length(violations, 1) > 0 THEN
    RAISE EXCEPTION E'Schema security lint failed:\n  - %', array_to_string(violations, E'\n  - ');
  END IF;

  RAISE NOTICE 'Schema security lint passed.';
END
$$;
