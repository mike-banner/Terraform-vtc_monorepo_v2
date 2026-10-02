-- Phase 14.1 : motif d'annulation « autre » (pourcentage libre choisi par le propriétaire ou le gestionnaire).
-- Fichier séparé : une valeur d'enum ajoutée n'est pas utilisable dans la même transaction.
ALTER TYPE public.cancellation_reason_enum ADD VALUE IF NOT EXISTS 'other';
