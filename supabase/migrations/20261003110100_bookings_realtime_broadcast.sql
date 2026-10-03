-- Phase 15 (R2, R3, ADR-014) : diffusion minimale des changements de courses sur un canal privé par tenant.
-- realtime.send et non realtime.broadcast_changes : ce dernier envoie la ligne entière (adresses, client, montants).
-- SECURITY DEFINER : realtime.send écrit avec les droits de l'appelant ; sans DEFINER, une écriture d'un client
-- (assignation) ne serait jamais diffusée. realtime.send avale ses erreurs : un échec de diffusion n'annule jamais
-- l'écriture de la course.
CREATE FUNCTION public.broadcast_booking_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  PERFORM realtime.send(
    jsonb_build_object(
      'id', NEW.id,
      'status', NEW.status,
      'mission_status', NEW.mission_status,
      'driver_id', NEW.driver_id,
      'updated_at', NEW.updated_at),
    'booking_changed',
    'tenant:' || NEW.current_tenant_id::text || ':bookings',
    true);
  RETURN NULL;
END $$;
-- Viser PUBLIC en plus de anon/authenticated : le droit hérité de PUBLIC resterait (lint règle 9).
REVOKE EXECUTE ON FUNCTION public.broadcast_booking_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_bookings_broadcast_ins AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_booking_change();
CREATE TRIGGER trg_bookings_broadcast_upd AFTER UPDATE ON public.bookings
  FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION public.broadcast_booking_change();

-- Réception : tout membre actif du tenant (owner, manager, driver) sur le seul topic de son tenant (D-01).
-- Aucune policy INSERT/UPDATE/DELETE : un client ne peut pas émettre (lint règle 11).
CREATE POLICY "realtime_tenant_bookings_receive" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    extension = 'broadcast'
    AND (select public.current_tenant_role()) IN ('owner', 'manager', 'driver')
    AND (select realtime.topic()) = 'tenant:' || (select public.current_tenant_id())::text || ':bookings'
  );
