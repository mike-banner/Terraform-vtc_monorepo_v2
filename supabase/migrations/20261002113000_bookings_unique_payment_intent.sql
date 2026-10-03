-- Une course par paiement Stripe : un événement livré deux fois, ou deux livraisons
-- simultanées, ne peuvent plus créer deux courses (le webhook traite 23505 comme un succès).
CREATE UNIQUE INDEX IF NOT EXISTS bookings_stripe_payment_intent_uniq
  ON public.bookings (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
