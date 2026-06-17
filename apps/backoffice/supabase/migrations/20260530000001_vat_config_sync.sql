-- 20260530000001_vat_config_sync.sql
-- Cohérence automatique TVA selon la forme juridique du tenant.
--
-- Règle fiscale française :
--   AUTO_ENTREPRENEUR / EI  → franchise en base Art. 293 B CGI → is_vat_exempt=true, vat_rate=0
--   SASU / SAS / EURL / SARL / OTHER → assujetti → is_vat_exempt=false, vat_rate=10 (transport)
--
-- Les prix dans pricing_rules sont supposés TTC.
-- Quand TVA applicable : net = gross / 1.10 ; vat = gross - net.

-- 1. Correction des tenants existants selon leur legal_form
UPDATE public.tenants
SET is_vat_exempt = true,
    vat_rate      = 0,
    vat_number    = NULL
WHERE legal_form IN ('auto_entrepreneur', 'ei')
   OR legal_form IS NULL;

UPDATE public.tenants
SET is_vat_exempt = false,
    vat_rate      = 10
WHERE legal_form IN ('sasu', 'sas', 'eurl', 'sarl', 'other')
  AND (is_vat_exempt = true OR vat_rate = 0);

-- 2. Trigger BEFORE UPDATE : synchronise is_vat_exempt + vat_rate quand legal_form change
CREATE OR REPLACE FUNCTION sync_tenant_vat_config()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Forme exonérée → force exemption
  IF NEW.legal_form IN ('auto_entrepreneur', 'ei') THEN
    NEW.is_vat_exempt := true;
    NEW.vat_rate      := 0;
    NEW.vat_number    := NULL;

  -- Forme assujettie → active TVA seulement si le tenant était encore exonéré
  -- (permet un override manuel via l'UI)
  ELSIF NEW.legal_form IN ('sasu', 'sas', 'eurl', 'sarl', 'other') THEN
    IF OLD.is_vat_exempt = true AND NEW.is_vat_exempt = true THEN
      NEW.is_vat_exempt := false;
      NEW.vat_rate      := 10;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tenant_vat ON public.tenants;
CREATE TRIGGER trg_sync_tenant_vat
  BEFORE UPDATE OF legal_form
  ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION sync_tenant_vat_config();
