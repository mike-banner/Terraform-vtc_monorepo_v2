-- Phase 13, R4 : le client n'écrit plus de colonnes financières ni de statut
-- de course en direct.
--
-- protect_booking_immutable_fields (Phase 11) ne suffit pas : il ignore status
-- et laisse modifier total_amount tant que la course est pending. Les écritures
-- légitimes passent toutes par le serveur (service_role, non concerné). On retire
-- donc l'UPDATE de table à authenticated et on ne rend que les colonnes
-- opérationnelles : réassignation (D-06), véhicule, note de mission, passagers,
-- bagages. Tout le reste (montants, TVA, statut, mission_status, paiement,
-- Stripe, facture, annulation, avis, adresses, horaire, tenants) -> 42501.
-- Transitions de statut : RPC de la Phase 14.

REVOKE UPDATE ON public.bookings FROM authenticated, anon;
GRANT UPDATE (driver_id, vehicle_id, mission_note, passenger_count, luggage_count)
  ON public.bookings TO authenticated;
