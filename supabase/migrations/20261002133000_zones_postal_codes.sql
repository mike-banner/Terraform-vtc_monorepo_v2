-- Plan 14.1-13 (D-32, D-44) : codes postaux des zones, écriture des zones et trajets par owner/manager.
-- Avant ce plan, aucune écriture possible depuis le backoffice (RLS sans policy d'écriture).

ALTER TABLE public.zones ADD COLUMN postal_codes text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.zones ADD CONSTRAINT zones_postal_codes_check
  CHECK (cardinality(postal_codes) <= 50 AND array_to_string(postal_codes, ',') ~ '^([0-9]{5}(,[0-9]{5})*)?$');

-- Garde-fou contre les accès concurrents ; le trigger donne le message en français.
CREATE UNIQUE INDEX zones_tenant_name_unique ON public.zones (tenant_id, lower(btrim(name))) WHERE tenant_id IS NOT NULL;

-- Definer : le contrôle ne dépend pas de la RLS de lecture ; il filtre toujours sur le tenant de la ligne,
-- donc ne lit ni ne cite jamais une zone d'un autre tenant.
CREATE FUNCTION public.zones_no_overlap() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE z record; v_code text;
BEGIN
  IF NEW.tenant_id IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(NEW.tenant_id::text));
  IF EXISTS (SELECT 1 FROM public.zones o WHERE o.tenant_id = NEW.tenant_id AND o.id <> NEW.id
               AND lower(btrim(o.name)) = lower(btrim(NEW.name))) THEN
    RAISE EXCEPTION 'Une zone de ce nom existe déjà : %', btrim(NEW.name) USING ERRCODE = '23505';
  END IF;
  IF cardinality(NEW.postal_codes) > 0 THEN
    SELECT o.name, c INTO z
      FROM public.zones o, unnest(NEW.postal_codes) AS c
     WHERE o.tenant_id = NEW.tenant_id AND o.id <> NEW.id AND o.postal_codes @> ARRAY[c]
     ORDER BY c LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'Ce code postal est déjà couvert par la zone % (code : %)', z.name, z.c USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.zones_no_overlap() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_zones_no_overlap BEFORE INSERT OR UPDATE OF name, postal_codes, tenant_id ON public.zones
  FOR EACH ROW EXECUTE FUNCTION public.zones_no_overlap();

-- zones : INSERT et UPDATE seulement (pas de DELETE : la cascade supprimerait les trajets).
DROP POLICY IF EXISTS "zones_insert" ON public.zones;
CREATE POLICY "zones_insert" ON public.zones
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (select public.current_tenant_id())
              AND (select public.current_tenant_role()) IN ('owner', 'manager'));
DROP POLICY IF EXISTS "zones_update" ON public.zones;
CREATE POLICY "zones_update" ON public.zones
  FOR UPDATE TO authenticated
  USING (tenant_id = (select public.current_tenant_id())
         AND (select public.current_tenant_role()) IN ('owner', 'manager'))
  WITH CHECK (tenant_id = (select public.current_tenant_id())
              AND (select public.current_tenant_role()) IN ('owner', 'manager'));

-- fixed_routes : les deux zones doivent être du tenant du trajet.
DROP POLICY IF EXISTS "fixed_routes_insert" ON public.fixed_routes;
CREATE POLICY "fixed_routes_insert" ON public.fixed_routes
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (select public.current_tenant_id())
              AND (select public.current_tenant_role()) IN ('owner', 'manager')
              AND EXISTS (SELECT 1 FROM public.zones z WHERE z.id = pickup_zone_id AND z.tenant_id = fixed_routes.tenant_id)
              AND EXISTS (SELECT 1 FROM public.zones z WHERE z.id = dropoff_zone_id AND z.tenant_id = fixed_routes.tenant_id));
DROP POLICY IF EXISTS "fixed_routes_update" ON public.fixed_routes;
CREATE POLICY "fixed_routes_update" ON public.fixed_routes
  FOR UPDATE TO authenticated
  USING (tenant_id = (select public.current_tenant_id())
         AND (select public.current_tenant_role()) IN ('owner', 'manager'))
  WITH CHECK (tenant_id = (select public.current_tenant_id())
              AND (select public.current_tenant_role()) IN ('owner', 'manager')
              AND EXISTS (SELECT 1 FROM public.zones z WHERE z.id = pickup_zone_id AND z.tenant_id = fixed_routes.tenant_id)
              AND EXISTS (SELECT 1 FROM public.zones z WHERE z.id = dropoff_zone_id AND z.tenant_id = fixed_routes.tenant_id));
DROP POLICY IF EXISTS "fixed_routes_delete" ON public.fixed_routes;
CREATE POLICY "fixed_routes_delete" ON public.fixed_routes
  FOR DELETE TO authenticated
  USING (tenant_id = (select public.current_tenant_id())
         AND (select public.current_tenant_role()) IN ('owner', 'manager'));
