-- Phase 14.1 (D-05) : trg_prevent_late_cancellation est retiré, pas réactivé. La règle d'annulation vit
-- désormais dans la politique d'annulation du tenant (cancel_booking). Le trigger est désactivé en production
-- et actif en local : les deux états convergent après cette migration.
DROP TRIGGER IF EXISTS trg_prevent_late_cancellation ON public.bookings;
DROP FUNCTION IF EXISTS public.prevent_late_cancellation();
