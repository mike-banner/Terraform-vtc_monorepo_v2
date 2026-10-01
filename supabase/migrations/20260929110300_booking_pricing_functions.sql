-- D-03 Phase 14 : formule de prix et décomposition TVA uniques pour les écritures (RPC du plan 05).
-- Portées à l'identique de apps/vtc-backoffice/src/lib/pricing.ts, qui ne sert plus qu'à l'aperçu client.
-- Ordre de règle figé sur created_at DESC (changement mineur : booking-actions ne triait pas).
-- Arrondi DECISION-ARRONDI V1 : net arrondi, TVA = brut - net, donc net + TVA = brut.
-- Exécution propre à l'appelant (pas de privilèges élevés) ; fermées aux clients, appelées par les RPC de confiance.

CREATE FUNCTION public.booking_vat_split(p_gross numeric, p_vat_rate numeric, p_is_exempt boolean)
RETURNS TABLE(net numeric, vat numeric, gross numeric)
LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE WHEN p_is_exempt IS DISTINCT FROM false OR coalesce(p_vat_rate, 0) <= 0 OR p_gross <= 0
              THEN p_gross
              ELSE round(p_gross / (1 + p_vat_rate / 100), 2) END,
         CASE WHEN p_is_exempt IS DISTINCT FROM false OR coalesce(p_vat_rate, 0) <= 0 OR p_gross <= 0
              THEN 0
              ELSE p_gross - round(p_gross / (1 + p_vat_rate / 100), 2) END,
         p_gross;
$$;

CREATE FUNCTION public.calculate_booking_price(p_tenant_id uuid, p_vehicle_id uuid,
  p_booking_type public.booking_type_enum, p_distance_km numeric, p_duration_hours numeric)
RETURNS numeric LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT greatest(
           coalesce(r.base_price, 0) + CASE WHEN p_booking_type = 'hourly'
             THEN coalesce(r.price_per_hour, 0) * coalesce(p_duration_hours, 1)
             ELSE coalesce(r.price_per_km, 0) * coalesce(p_distance_km, 0) END,
           coalesce(r.minimum_fare, 0))
  FROM public.pricing_rules r
  WHERE r.tenant_id = p_tenant_id AND r.active IS TRUE
  ORDER BY (lower(trim(r.service_category)) = coalesce(
             (SELECT lower(v.category::text) FROM public.vehicles v
               WHERE v.id = p_vehicle_id AND v.tenant_id = p_tenant_id), '')) DESC,
           r.created_at DESC
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.booking_vat_split(numeric, numeric, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_booking_price(uuid, uuid, public.booking_type_enum, numeric, numeric) FROM PUBLIC, anon, authenticated;
