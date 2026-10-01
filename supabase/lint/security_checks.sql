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

  -- Policies d'écriture autorisées sans condition pour anon/public (format table.policy).
  allowed_open_write_policies text[] := ARRAY[]::text[];

  -- Tables couvertes par la matrice de rôles tenant (Phase 13) : une policy par
  -- commande, jamais FOR ALL. Les policies service_role sont hors RLS (BYPASSRLS).
  role_tables text[] := ARRAY['bookings', 'customers', 'drivers', 'vehicles', 'pricing_rules', 'financial_movements'];

  -- Fonctions SECURITY DEFINER exécutables par anon (RPC publiques). Les deux dernières sont
  -- les RPC de notation du plan 14-07.
  allowed_anon_definer text[] := ARRAY['get_public_tenant','get_available_vehicles','get_public_booking_result','get_rating_context','submit_rating'];
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

  -- 4. Policy d'écriture sans condition ouverte à anon ou public : la clé anon est
  --    publique, n'importe qui peut écrire. Cas réel : platform_settings (Phase 12).
  FOR r IN
    SELECT pol.tablename, pol.policyname
    FROM pg_policies pol
    WHERE pol.schemaname = 'public'
      AND pol.cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      AND (pol.roles && ARRAY['public', 'anon']::name[])
      AND (trim(COALESCE(pol.qual, '')) = 'true' OR trim(COALESCE(pol.with_check, '')) = 'true')
      AND NOT ((pol.tablename || '.' || pol.policyname) = ANY (allowed_open_write_policies))
  LOOP
    violations := violations || format('policy %I on %I allows unconditional writes to anon/public', r.policyname, r.tablename);
  END LOOP;

  -- 5. Policy FOR ALL sur une table de la matrice : couvre aussi INSERT/UPDATE/
  --    DELETE et, sans WITH CHECK, réutilise USING. Cas réel : drivers_isolation
  --    rendait drivers_insert_owner_only sans effet (Phase 13).
  FOR r IN
    SELECT pol.tablename, pol.policyname
    FROM pg_policies pol
    WHERE pol.schemaname = 'public'
      AND pol.tablename = ANY (role_tables)
      AND pol.cmd = 'ALL'
      AND pol.roles <> ARRAY['service_role']::name[]
  LOOP
    violations := violations || format('policy %I on %I is FOR ALL (one policy per command)', r.policyname, r.tablename);
  END LOOP;

  -- 6. Plusieurs policies pour une même (table, commande) : les policies
  --    permissives s'additionnent (OR), la plus large gagne en silence.
  FOR r IN
    SELECT pol.tablename, pol.cmd, string_agg(pol.policyname, ', ' ORDER BY pol.policyname) AS names
    FROM pg_policies pol
    WHERE pol.schemaname = 'public'
      AND pol.tablename = ANY (role_tables)
      AND pol.roles <> ARRAY['service_role']::name[]
    GROUP BY pol.tablename, pol.cmd
    HAVING count(*) > 1
  LOOP
    violations := violations || format('table %I has several %s policies (%s)', r.tablename, r.cmd, r.names);
  END LOOP;

  -- 7. Trigger de garde de bookings absent ou désactivé. Dérive constatée en prod le 2026-09-29
  --    (trois triggers en tgenabled='D'). Exception assumée : trg_prevent_late_cancellation reste désactivé en
  --    production (plan 14-13, 2026-10-01) tant que la « non réalisée » d'une course payée n'est pas conçue ; il est
  --    donc absent de cette liste. À réintégrer dès qu'il est réactivé.
  FOR r IN
    SELECT t.name
    FROM unnest(ARRAY['trg_prevent_booking_delete',
      'trg_prevent_pickup_time_change_after_paid','trg_prevent_policy_update','trg_protect_booking_fields',
      'trg_validate_booking_status_transition','trg_auto_financial_movement']) AS t(name)
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_trigger g
      WHERE g.tgrelid = 'public.bookings'::regclass AND g.tgname = t.name AND g.tgenabled = 'O'
    )
  LOOP
    violations := violations || format('trigger %I on bookings is missing or disabled', r.name);
  END LOOP;

  -- 8. Table de transitions vide : trg_validate_booking_status_transition rejetterait tout changement de statut.
  IF (SELECT count(*) FROM public.booking_status_transitions) = 0 THEN
    violations := violations || 'booking_status_transitions is empty';
  END IF;

  -- 9. Fonction SECURITY DEFINER exécutable par anon hors allowlist (le droit peut venir de PUBLIC).
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND NOT (p.proname = ANY (allowed_anon_definer))
  LOOP
    violations := violations || format('function %I(%s) is SECURITY DEFINER and executable by anon', r.proname, r.args);
  END LOOP;

  -- 10. Invariant qui rend vtc.trusted_rpc non exploitable (ADR-012) : anon/authenticated n'ont
  --     aucun privilège UPDATE sur les colonnes sensibles de bookings, ni policy INSERT/ALL sur
  --     bookings et financial_movements.
  FOR r IN
    SELECT ro.name AS role_name, c.name AS col
    FROM unnest(ARRAY['anon','authenticated']) AS ro(name),
         unnest(ARRAY['status','mission_status','total_amount','subtotal_amount','vat_amount','payment_mode',
           'pickup_time','pickup_address','dropoff_address','rating','cancellation_policy_id']) AS c(name)
    WHERE has_column_privilege(ro.name, 'public.bookings', c.name, 'UPDATE')
  LOOP
    violations := violations || format('role %s can UPDATE bookings.%s (breaks ADR-012 invariant)', r.role_name, r.col);
  END LOOP;
  FOR r IN
    SELECT pol.tablename, pol.policyname
    FROM pg_policies pol
    WHERE pol.schemaname = 'public'
      AND pol.tablename IN ('bookings', 'financial_movements')
      AND pol.cmd IN ('INSERT', 'ALL')
      AND pol.roles && ARRAY['public', 'anon', 'authenticated']::name[]
  LOOP
    violations := violations || format('policy %I on %I allows INSERT to clients (breaks ADR-012 invariant)', r.policyname, r.tablename);
  END LOOP;

  IF array_length(violations, 1) > 0 THEN
    RAISE EXCEPTION E'Schema security lint failed:\n  - %', array_to_string(violations, E'\n  - ');
  END IF;

  RAISE NOTICE 'Schema security lint passed.';
END
$$;
