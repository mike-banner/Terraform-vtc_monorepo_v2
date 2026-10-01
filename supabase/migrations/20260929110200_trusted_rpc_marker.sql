-- ADR-012 : une RPC SECURITY DEFINER de confiance pose set_config('vtc.trusted_rpc','on',true)
-- (portée : la transaction). auto_create_financial_movement et protect_booking_immutable_fields
-- l'acceptent. Le marqueur n'ouvre rien à un client : authenticated/anon n'ont aucun chemin
-- d'écriture qui déclenche ces branches (invariant vérifié par la règle 10 de
-- supabase/lint/security_checks.sql et par supabase/lint/rpc_socle_checks.sql).
-- Corps recopiés à l'identique (empreintes relevées au plan 14-01), seule la condition change.

CREATE OR REPLACE FUNCTION public.auto_create_financial_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_gross  numeric;
  v_net    numeric;
  v_vat    numeric;
  v_is_payment boolean;
  v_is_cash boolean;
BEGIN
  v_is_payment := NEW.payment_mode IN ('card', 'stripe')
     AND NEW.status = 'paid'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid');
  v_is_cash := NEW.payment_mode = 'cash'
     AND NEW.mission_status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.mission_status IS DISTINCT FROM 'completed');

  IF (v_is_payment OR v_is_cash)
     AND coalesce(auth.jwt() ->> 'role', 'service_role') <> 'service_role'
     AND coalesce(current_setting('vtc.trusted_rpc', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Encaissement enregistrable uniquement par le serveur'
      USING ERRCODE = '42501';
  END IF;

  v_gross := COALESCE(NEW.total_amount, 0);
  v_vat   := COALESCE(NEW.vat_amount,   0);
  v_net   := CASE WHEN v_gross > v_vat THEN v_gross - v_vat ELSE v_gross END;

  -- Cas 1 : Paiement electronique (Stripe checkout ou card directe)
  IF v_is_payment
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

  -- Cas 2 : Paiement cash / especes
  IF v_is_cash
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
$function$;

CREATE OR REPLACE FUNCTION public.protect_booking_immutable_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(current_setting('vtc.trusted_rpc', true), '') = 'on' THEN RETURN NEW; END IF;

  IF OLD.status <> 'pending' THEN
    IF NEW.total_amount <> OLD.total_amount
       OR NEW.pickup_address <> OLD.pickup_address
       OR NEW.dropoff_address <> OLD.dropoff_address
       OR NEW.pickup_time <> OLD.pickup_time
       OR NEW.payment_mode <> OLD.payment_mode THEN
         RAISE EXCEPTION 'Booking immutable after pending status';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
