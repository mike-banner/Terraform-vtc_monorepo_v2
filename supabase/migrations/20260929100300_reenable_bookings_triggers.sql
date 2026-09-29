-- Constat du 2026-09-29 (déploiement Phase 13) : trois triggers de garde sur `bookings`
-- étaient désactivés en production (tgenabled='D'), alors qu'ils sont actifs en local.
-- Aucune migration du repo ne les désactive — dérive antérieure, cause inconnue, sans
-- lien avec les migrations de la Phase 13. Réactivation pure, aucune logique modifiée.

ALTER TABLE public.bookings ENABLE TRIGGER trg_protect_booking_fields;
ALTER TABLE public.bookings ENABLE TRIGGER trg_prevent_booking_delete;
ALTER TABLE public.bookings ENABLE TRIGGER trg_validate_booking_status_transition;
