-- 20260531000000_vat_on_insert.sql
-- Le trigger existant (trg_sync_tenant_vat) ne couvre que UPDATE OF legal_form.
-- Ce trigger couvre l'INSERT : chaque nouveau tenant reçoit is_vat_exempt et vat_rate
-- corrects dès sa création (via approve_onboarding_tx ou tout autre INSERT).

CREATE OR REPLACE FUNCTION set_tenant_vat_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.legal_form IN ('auto_entrepreneur', 'ei') THEN
    NEW.is_vat_exempt := true;
    NEW.vat_rate      := 0;
    NEW.vat_number    := NULL;
  ELSIF NEW.legal_form IN ('sasu', 'sas', 'eurl', 'sarl', 'other') THEN
    NEW.is_vat_exempt := false;
    NEW.vat_rate      := 10;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_tenant_vat_on_insert ON public.tenants;
CREATE TRIGGER trg_set_tenant_vat_on_insert
  BEFORE INSERT
  ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_vat_on_insert();
