---
phase: 14-routes-serveur-rpc-edge-functions
plan: 01
status: complete
---

# 14-01 — Relevé prod et décisions

## Relevé prod 2026-09-29

(Relevé rejoué le 2026-10-01, projet `kpnkhmtxzigxtfnkmzru`, lecture seule : `execute_sql` SELECT et `list_migrations` uniquement.)

1. Transitions : 13 lignes, identiques à `<facts>` (pas de `accepted>completed`).
2. Triggers `bookings` : trg_auto_financial_movement O, trg_prevent_booking_delete O, trg_prevent_late_cancellation D, trg_prevent_pickup_time_change_after_paid D, trg_prevent_policy_update D, trg_protect_booking_fields O, trg_validate_booking_status_transition O.
3. `pricing_rules` : active, base_price, created_at, id, minimum_fare, price_per_hour, price_per_km, service_category, tenant_id. Pas de `price_per_minute` (A5 confirmée).
4. Logos : avec_logo = 2, conformes à la règle du plan 06 = 1. UNE URL existante ne passe pas la regex : à traiter au plan 06 (assouplir la règle ou migrer la donnée), à ne pas ignorer.
5. Courses cash : accepted non terminées = 0 ; completed cash = 2.
6. Noms de RPC de la phase déjà pris : aucun (0 ligne).
7. `list_migrations` : dernière version 20260929100300, pas de version sans fichier local.
8. Empreintes (prod = local après `supabase db reset --no-seed`, migrations <= 20260929100300) : identiques.

## Empreintes de référence

FUNCDEF-MD5 auto_create_financial_movement: ee9e0f5362cd59087580a934f54b89c6
FUNCDEF-MD5 protect_booking_immutable_fields: 5a36297039501399441be6bc4c588a67
FUNCDEF-PROD-LOCAL: identique

### Définitions locales de référence

```sql
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
$function$

```

```sql
CREATE OR REPLACE FUNCTION public.protect_booking_immutable_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
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
$function$

```

## Décisions

DECISION-CASH: C1
DECISION-EDIT: A
DECISION-ARRONDI: V1

Réponse utilisateur (citation littérale du /goal) : « ouvre une branche et execute la phase 14 tout les plans jusqua la fin en gardant la methode gsd  tu les valides a chaque fois et tu continues sans moi ».
Le goal délègue la décision ; les options recommandées par le plan ont été retenues par défaut (C1 + A + V1). Décision révisable par l'utilisateur à tout moment avant le push en prod (plan 10).
