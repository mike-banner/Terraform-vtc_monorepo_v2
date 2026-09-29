-- Phase 13 : rôles tenant dans la RLS.
--
-- Matrice (CONTEXT.md D-01 à D-11) — OM = owner ou manager du tenant appelant :
--   bookings            SELECT tenant (+ plateforme) | INSERT service_role | UPDATE OM : tout le tenant,
--                       driver : ses courses (driver_id) | DELETE aucun
--   drivers             SELECT tenant | INSERT/DELETE OM | UPDATE OM ; driver : sa
--                       fiche (user_id), colonne phone seule (trigger, D-08)
--   vehicles            SELECT tenant | INSERT/UPDATE/DELETE OM
--   pricing_rules       SELECT public_read_pricing (inchangée) | INSERT/UPDATE/DELETE OM
--   customers           SELECT/INSERT/UPDATE/DELETE tenant
--   financial_movements SELECT OM (+ plateforme) | INSERT service_role (inchangée) | immuable
--   zones, fixed_routes, cancellation_policies : inchangées (écriture service_role seul)
--
-- Les policies permissives s'additionnent (OR) : une policy large laissée en
-- place annule toute policy plus étroite. On droppe donc par nom, sans IF EXISTS,
-- toutes les policies larges ou en doublon avant de recréer une policy par
-- (table, commande). Colonnes financières et statut de bookings : voir
-- 20260929100200_bookings_client_update_columns.sql.

-- bookings ----------------------------------------------------------------
DROP POLICY "bookings_insert_isolation"     ON public.bookings;
DROP POLICY "admin_full_view_platform_read" ON public.bookings;
DROP POLICY "bookings_platform_admin_read"  ON public.bookings;
DROP POLICY "bookings_select"               ON public.bookings;
DROP POLICY "bookings_select_isolation"     ON public.bookings;
DROP POLICY "select bookings tenant"        ON public.bookings;
DROP POLICY "bookings_update_isolation"     ON public.bookings;
DROP POLICY "update bookings tenant"        ON public.bookings;

-- D-03/D-04 : tout le tenant voit toutes ses courses (le driver repère les non assignées).
CREATE POLICY "bookings_select" ON public.bookings
  FOR SELECT TO authenticated
  USING (
    original_tenant_id = (select public.current_tenant_id())
    OR current_tenant_id = (select public.current_tenant_id())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.platform_role IN ('super_admin', 'platform_staff')
    )
  );

-- D-05/D-06 : OM écrit toutes les courses du tenant et réassigne driver_id vers un
-- chauffeur du tenant ; le driver n'écrit que ses courses et ne peut pas les céder.
CREATE POLICY "bookings_update" ON public.bookings
  FOR UPDATE TO authenticated
  USING (
    (original_tenant_id = (select public.current_tenant_id())
      OR current_tenant_id = (select public.current_tenant_id()))
    AND (
      (select public.current_tenant_role()) IN ('owner', 'manager')
      OR (
        (select public.current_tenant_role()) = 'driver'
        AND driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid())
      )
    )
  )
  WITH CHECK (
    (original_tenant_id = (select public.current_tenant_id())
      OR current_tenant_id = (select public.current_tenant_id()))
    AND (
      (
        (select public.current_tenant_role()) IN ('owner', 'manager')
        AND (
          driver_id IS NULL
          OR driver_id IN (SELECT d.id FROM public.drivers d
                           WHERE d.tenant_id = (select public.current_tenant_id()))
        )
      )
      OR (
        (select public.current_tenant_role()) = 'driver'
        AND driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid())
      )
    )
  );
-- Pas de policy INSERT : les courses sont créées par le serveur (service_role).
-- Pas de policy DELETE : suppression interdite (trg_prevent_booking_delete).

-- customers (D-10) ------------------------------------------------------------
DROP POLICY "customers_tenant_isolation_auth" ON public.customers;

CREATE POLICY "customers_select" ON public.customers
  FOR SELECT TO authenticated
  USING (tenant_id = (select public.current_tenant_id()));
CREATE POLICY "customers_insert" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (select public.current_tenant_id()));
CREATE POLICY "customers_update" ON public.customers
  FOR UPDATE TO authenticated
  USING (tenant_id = (select public.current_tenant_id()))
  WITH CHECK (tenant_id = (select public.current_tenant_id()));
CREATE POLICY "customers_delete" ON public.customers
  FOR DELETE TO authenticated
  USING (tenant_id = (select public.current_tenant_id()));

-- drivers (D-01, D-07, D-08) ---------------------------------------------------
DROP POLICY "drivers_isolation"         ON public.drivers;
DROP POLICY "drivers_tenant_isolation"  ON public.drivers;
DROP POLICY "drivers_insert_owner_only" ON public.drivers;

CREATE POLICY "drivers_select" ON public.drivers
  FOR SELECT TO authenticated
  USING (tenant_id = (select public.current_tenant_id()));
CREATE POLICY "drivers_insert" ON public.drivers
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (select public.current_tenant_id())
              AND (select public.current_tenant_role()) IN ('owner', 'manager'));
-- D-08 : le driver modifie sa propre fiche ; les colonnes sont limitées par
-- trg_drivers_self_update_guard ci-dessous.
CREATE POLICY "drivers_update" ON public.drivers
  FOR UPDATE TO authenticated
  USING (tenant_id = (select public.current_tenant_id())
         AND ((select public.current_tenant_role()) IN ('owner', 'manager')
              OR ((select public.current_tenant_role()) = 'driver'
                  AND user_id = (select auth.uid()))))
  WITH CHECK (tenant_id = (select public.current_tenant_id())
              AND ((select public.current_tenant_role()) IN ('owner', 'manager')
                   OR ((select public.current_tenant_role()) = 'driver'
                       AND user_id = (select auth.uid()))));
CREATE POLICY "drivers_delete" ON public.drivers
  FOR DELETE TO authenticated
  USING (tenant_id = (select public.current_tenant_id())
         AND (select public.current_tenant_role()) IN ('owner', 'manager'));

-- D-08 : le driver ne change que son téléphone. Pas de GRANT UPDATE (phone) :
-- un privilège de colonne vaut pour tout authenticated, owner/manager compris
-- (D-07). Comparaison OLD/NEW car EditableDriverCard renvoie first_name,
-- last_name, phone et license_number à chaque sauvegarde : des valeurs
-- inchangées passent. service_role/postgres : current_tenant_role() NULL.
CREATE FUNCTION public.drivers_self_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF (select public.current_tenant_role()) = 'driver'
     AND (to_jsonb(NEW) - 'phone') IS DISTINCT FROM (to_jsonb(OLD) - 'phone') THEN
    RAISE EXCEPTION 'Un chauffeur ne peut modifier que son téléphone'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER trg_drivers_self_update_guard
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.drivers_self_update_guard();

-- vehicles (D-01, D-11) --------------------------------------------------------
DROP POLICY "vehicles_isolation"        ON public.vehicles;
DROP POLICY "vehicles_tenant_isolation" ON public.vehicles;

CREATE POLICY "vehicles_select" ON public.vehicles
  FOR SELECT TO authenticated
  USING (tenant_id = (select public.current_tenant_id()));
CREATE POLICY "vehicles_insert" ON public.vehicles
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (select public.current_tenant_id())
              AND (select public.current_tenant_role()) IN ('owner', 'manager'));
CREATE POLICY "vehicles_update" ON public.vehicles
  FOR UPDATE TO authenticated
  USING (tenant_id = (select public.current_tenant_id())
         AND (select public.current_tenant_role()) IN ('owner', 'manager'))
  WITH CHECK (tenant_id = (select public.current_tenant_id())
              AND (select public.current_tenant_role()) IN ('owner', 'manager'));
CREATE POLICY "vehicles_delete" ON public.vehicles
  FOR DELETE TO authenticated
  USING (tenant_id = (select public.current_tenant_id())
         AND (select public.current_tenant_role()) IN ('owner', 'manager'));

-- pricing_rules (D-01, D-11) ---------------------------------------------------
-- Lecture : public_read_pricing (true, tunnels publics) est conservée et couvre
-- déjà tout le tenant ; une policy SELECT tenant en plus serait un doublon.
DROP POLICY "pricing_isolation"        ON public.pricing_rules;
DROP POLICY "pricing_tenant_isolation" ON public.pricing_rules;

CREATE POLICY "pricing_rules_insert" ON public.pricing_rules
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (select public.current_tenant_id())
              AND (select public.current_tenant_role()) IN ('owner', 'manager'));
CREATE POLICY "pricing_rules_update" ON public.pricing_rules
  FOR UPDATE TO authenticated
  USING (tenant_id = (select public.current_tenant_id())
         AND (select public.current_tenant_role()) IN ('owner', 'manager'))
  WITH CHECK (tenant_id = (select public.current_tenant_id())
              AND (select public.current_tenant_role()) IN ('owner', 'manager'));
CREATE POLICY "pricing_rules_delete" ON public.pricing_rules
  FOR DELETE TO authenticated
  USING (tenant_id = (select public.current_tenant_id())
         AND (select public.current_tenant_role()) IN ('owner', 'manager'));

-- financial_movements (D-09) ---------------------------------------------------
DROP POLICY "finance_select_isolated"       ON public.financial_movements;
DROP POLICY "financial_platform_admin_read" ON public.financial_movements;
DROP POLICY "platform_admin_read_financial" ON public.financial_movements;
DROP POLICY "tenant_can_view_own_finance"   ON public.financial_movements;

CREATE POLICY "financial_movements_select" ON public.financial_movements
  FOR SELECT TO authenticated
  USING (
    (tenant_id = (select public.current_tenant_id())
     AND (select public.current_tenant_role()) IN ('owner', 'manager'))
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.platform_role IN ('super_admin', 'platform_staff')
    )
  );
