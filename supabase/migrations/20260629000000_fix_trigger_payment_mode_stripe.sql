-- 20260629000000_fix_trigger_payment_mode_stripe.sql
-- Fix: le trigger ne couvrait que payment_mode='card' mais le webhook insère 'stripe'.
-- On couvre les deux + 'especes' (alias cash) si jamais ajouté plus tard.
-- Cas 1 : payment_mode IN ('card','stripe') + status='paid'
-- Cas 2 : payment_mode IN ('cash','especes') + mission_status='completed'

CREATE OR REPLACE FUNCTION auto_create_financial_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gross  numeric;
  v_net    numeric;
  v_vat    numeric;
BEGIN
  v_gross := COALESCE(NEW.total_amount, 0);
  v_vat   := COALESCE(NEW.vat_amount,   0);
  v_net   := CASE WHEN v_gross > v_vat THEN v_gross - v_vat ELSE v_gross END;

  -- Cas 1 : Paiement électronique (Stripe checkout ou card directe)
  IF NEW.payment_mode IN ('card', 'stripe')
     AND NEW.status = 'paid'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid')
     AND NOT EXISTS (
       SELECT 1 FROM financial_movements WHERE booking_id = NEW.id AND movement_type = 'payment'
     )
  THEN
    INSERT INTO financial_movements (
      booking_id, tenant_id, stripe_payment_intent_id,
      movement_type, direction,
      gross_amount, net_amount, vat_amount,
      created_by_event
    ) VALUES (
      NEW.id, NEW.current_tenant_id, NEW.stripe_payment_intent_id,
      'payment', 'credit',
      v_gross, v_net, v_vat,
      'stripe_payment'
    );
  END IF;

  -- Cas 2 : Paiement cash / espèces
  IF NEW.payment_mode IN ('cash', 'especes')
     AND NEW.mission_status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.mission_status IS DISTINCT FROM 'completed')
     AND NOT EXISTS (
       SELECT 1 FROM financial_movements WHERE booking_id = NEW.id AND movement_type = 'payment'
     )
  THEN
    INSERT INTO financial_movements (
      booking_id, tenant_id,
      movement_type, direction,
      gross_amount, net_amount, vat_amount,
      created_by_event
    ) VALUES (
      NEW.id, NEW.current_tenant_id,
      'payment', 'credit',
      v_gross, v_net, v_vat,
      'cash_completion'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill : bookings stripe déjà status='paid' sans mouvement (bug rétroactif)
INSERT INTO financial_movements (
  booking_id, tenant_id, stripe_payment_intent_id,
  movement_type, direction,
  gross_amount, net_amount, vat_amount,
  created_by_event
)
SELECT
  b.id,
  b.current_tenant_id,
  b.stripe_payment_intent_id,
  'payment',
  'credit',
  COALESCE(b.total_amount, 0),
  CASE WHEN COALESCE(b.total_amount, 0) > COALESCE(b.vat_amount, 0)
       THEN COALESCE(b.total_amount, 0) - COALESCE(b.vat_amount, 0)
       ELSE COALESCE(b.total_amount, 0) END,
  COALESCE(b.vat_amount, 0),
  'backfill_fix_stripe'
FROM bookings b
WHERE b.payment_mode IN ('card', 'stripe')
  AND b.status = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM financial_movements fm WHERE fm.booking_id = b.id
  );
