-- 20260530000000_auto_financial_movements_trigger.sql
-- Trigger qui alimente financial_movements automatiquement sur INSERT/UPDATE de bookings.
-- Deux cas couverts :
--   1. Paiement Stripe (payment_mode = 'card') : quand status devient 'paid'
--   2. Paiement cash (payment_mode = 'cash')   : quand mission_status devient 'completed'
-- SECURITY DEFINER requis pour bypasser la policy RLS finance_insert_service_only.

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

  -- Cas 1 : Stripe card — status transite vers 'paid'
  IF NEW.payment_mode = 'card'
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

  -- Cas 2 : Cash — mission_status transite vers 'completed'
  IF NEW.payment_mode = 'cash'
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

DROP TRIGGER IF EXISTS trg_auto_financial_movement ON bookings;
CREATE TRIGGER trg_auto_financial_movement
  AFTER INSERT OR UPDATE OF status, mission_status
  ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_financial_movement();

-- Backfill : bookings card déjà status='paid' sans mouvement existant
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
  'backfill_migration'
FROM bookings b
WHERE b.payment_mode = 'card'
  AND b.status = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM financial_movements fm WHERE fm.booking_id = b.id
  );
