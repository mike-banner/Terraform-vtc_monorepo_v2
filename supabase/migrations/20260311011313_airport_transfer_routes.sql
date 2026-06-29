-- 1. Création des Zones
CREATE TABLE IF NOT EXISTS public.zones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 2. Création des Trajets Fixes (Forfaits)
CREATE TABLE IF NOT EXISTS public.fixed_routes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    pickup_zone_id uuid REFERENCES public.zones(id) ON DELETE CASCADE,
    dropoff_zone_id uuid REFERENCES public.zones(id) ON DELETE CASCADE,
    vehicle_category text NOT NULL,
    price numeric NOT NULL CHECK (price > 0),
    is_bidirectional boolean DEFAULT true, -- Permet d'appliquer le prix dans les deux sens
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    -- CONTRAINTE D'UNICITÉ : Empêche les doublons pour un même trajet/véhicule/chauffeur
    CONSTRAINT unique_tenant_route_category UNIQUE (tenant_id, pickup_zone_id, dropoff_zone_id, vehicle_category)
);

-- 3. Index de performance (Recherche ultra-rapide par le Front)
CREATE INDEX IF NOT EXISTS idx_fixed_routes_query
ON public.fixed_routes (tenant_id, pickup_zone_id, dropoff_zone_id);

-- 4. RLS & POLICIES
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_zones" ON public.zones;
CREATE POLICY "public_read_zones" ON public.zones FOR SELECT USING (true);

DROP POLICY IF EXISTS "public_read_fixed_routes" ON public.fixed_routes;
CREATE POLICY "public_read_fixed_routes" ON public.fixed_routes FOR SELECT USING (true);
