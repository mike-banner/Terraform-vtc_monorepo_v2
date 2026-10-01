-- La table booking_status_transitions n'était peuplée qu'en production, jamais par une
-- migration : sur une base reconstruite (local, CI), trg_validate_booking_status_transition
-- rejetait tout changement de statut. Contenu relevé en production le 2026-09-29 (plan 14-01).

INSERT INTO public.booking_status_transitions (from_status, to_status) VALUES
  ('accepted','accepted_pending_payment'), ('accepted','cancelled_no_refund'),
  ('accepted_pending_payment','cancelled_no_refund'), ('accepted_pending_payment','expired_payment'),
  ('accepted_pending_payment','paid'), ('cancelled_pending_refund','cancelled_refunded'),
  ('cancelled_pending_refund','refund_failed'), ('paid','cancelled_pending_refund'), ('paid','completed'),
  ('paid','no_show'), ('pending','accepted'), ('pending','cancelled_no_refund'),
  ('refund_failed','cancelled_pending_refund')
ON CONFLICT (from_status, to_status) DO NOTHING;
