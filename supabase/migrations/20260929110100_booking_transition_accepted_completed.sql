-- Décision utilisateur du plan 14-01 (DECISION-CASH: C1) : fin de course cash d'une course
-- manuelle créée directement en `accepted`. terrain_transition n'accepte ce passage que
-- pour payment_mode = 'cash'.

INSERT INTO public.booking_status_transitions (from_status, to_status) VALUES
  ('accepted','completed')
ON CONFLICT (from_status, to_status) DO NOTHING;
