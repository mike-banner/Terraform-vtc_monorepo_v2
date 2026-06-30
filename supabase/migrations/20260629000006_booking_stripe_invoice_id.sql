-- Colonne stripe_invoice_id sur bookings : verrou d'idempotence pour generate-invoice (CR-03)
-- Permet de détecter une facture Stripe déjà créée et d'éviter la double-facturation sur retry.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT;
