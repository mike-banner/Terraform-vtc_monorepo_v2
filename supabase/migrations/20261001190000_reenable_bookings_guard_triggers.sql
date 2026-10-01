-- Plan 14-13 (décision utilisateur « partiel », 2026-10-01) : réactive en production deux des trois triggers de garde de
-- bookings désactivés (tgenabled = 'D', cause inconnue, constat 13-04). Analyse des flux : aucun flux Edge Function, superadmin
-- ou RPC n'est bloqué par ces deux-là ; aucune course n'a de cancellation_policy_id.
--   trg_prevent_pickup_time_change_after_paid : pas de changement d'heure une fois la course payée, terminée, non réalisée ou annulée
--   trg_prevent_policy_update                 : pas de changement de politique d'annulation une fois posée
-- trg_prevent_late_cancellation reste désactivé volontairement : réactivé, il laisserait une course payée dont l'heure est
-- passée sans issue (annulation refusée par le trigger, « non réalisée » refusée par la RPC tant que le flux de
-- remboursement n'est pas conçu). Exception documentée dans la règle 7 de supabase/lint/security_checks.sql.
-- Idempotent : sans effet en local, où ils sont déjà actifs.

ALTER TABLE public.bookings ENABLE TRIGGER trg_prevent_pickup_time_change_after_paid;
ALTER TABLE public.bookings ENABLE TRIGGER trg_prevent_policy_update;
