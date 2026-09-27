-- 20260927023037_close_anon_write_paths.sql
--
-- Ferme les écritures que la clé publique `anon` permettait. Cette clé est embarquée
-- dans le bundle de chaque site tenant : elle est connue de tous.
--
-- 1. platform_settings : policy UPDATE `USING (true)` pour `public` et droit UPDATE
--    accordé à anon. N'importe qui pouvait réécrire les taux de commission plateforme.
-- 2. bookings : `insert_bookings_public` (`WITH CHECK original_tenant_id IS NOT NULL`)
--    laissait anon insérer une course `status = paid` chez n'importe quel tenant ;
--    trg_auto_financial_movement (SECURITY DEFINER) écrivait alors une recette dans
--    financial_movements, ledger immuable.
-- 3. customers : `insert_customers_public`, même schéma.
--
-- Aucun flux légitime n'en dépend : les réservations et les clients sont créés par les
-- Edge Functions (create_checkout_session, stripe_webhook, create_customer) en
-- service_role. Seul client anon qui écrivait : le formulaire de devis de vtc-websites,
-- mort (aucune page ne l'appelle) et cassé (colonne client_name inexistante), supprimé
-- dans le même lot.

-- 1. platform_settings : lecture et écriture réservées au super_admin.
--    Aucun code applicatif ne lit cette table ; seule update_platform_settings_updated_at
--    la touche (trigger).
DROP POLICY IF EXISTS platform_settings_read_admin ON public.platform_settings;
DROP POLICY IF EXISTS platform_settings_update_admin ON public.platform_settings;

CREATE POLICY platform_settings_select_super_admin ON public.platform_settings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.platform_role = 'super_admin'
  ));

CREATE POLICY platform_settings_update_super_admin ON public.platform_settings
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.platform_role = 'super_admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.platform_role = 'super_admin'
  ));

-- 2 et 3. Plus d'INSERT anonyme sur bookings et customers.
DROP POLICY IF EXISTS insert_bookings_public ON public.bookings;
DROP POLICY IF EXISTS insert_customers_public ON public.customers;

-- Défense en profondeur : anon n'a plus aucun droit d'écriture sur ces tables, quelle
-- que soit la policy qu'on y ajouterait un jour par erreur.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.platform_settings FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.bookings FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.customers FROM anon;

-- 4. Le ledger n'est alimenté que par le serveur. Toutes les transitions légitimes
--    (routes API du backoffice, Edge Functions) écrivent en service_role. Un client
--    anon ou authenticated qui produirait un encaissement est refusé plutôt qu'ignoré :
--    ignorer laisserait une course payée sans mouvement comptable.
--    Session sans JWT (migration, console SQL) : autorisée.
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
     AND coalesce(auth.jwt() ->> 'role', 'service_role') <> 'service_role' THEN
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
