-- 20260927030100_merge_tenant_vat_triggers.sql
--
-- Fusionne les deux synchronisations TVA des tenants en une seule fonction.
--
-- set_tenant_vat_on_insert (20260531000000, BEFORE INSERT) et sync_tenant_vat_config
-- (20260530000001, BEFORE UPDATE OF legal_form) portaient la même table de
-- correspondance forme juridique -> TVA, en double. Seule différence, conservée :
-- à la mise à jour, une forme assujettie n'écrase pas un réglage manuel (on ne passe
-- à 10 % que si le tenant était et restait exonéré).
--
-- Comportement inchangé, vérifié sur base locale avant/après (INSERT et UPDATE, formes
-- exonérées et assujetties, override manuel conservé).

CREATE OR REPLACE FUNCTION public.sync_tenant_vat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.legal_form IN ('auto_entrepreneur', 'ei') THEN
    NEW.is_vat_exempt := true;
    NEW.vat_rate      := 0;
    NEW.vat_number    := NULL;

  ELSIF NEW.legal_form IN ('sasu', 'sas', 'eurl', 'sarl', 'other') THEN
    -- Création : TVA par défaut. Mise à jour : seulement si le tenant était encore
    -- exonéré, pour ne pas écraser un réglage fait dans l'UI.
    IF TG_OP = 'INSERT' OR (OLD.is_vat_exempt = true AND NEW.is_vat_exempt = true) THEN
      NEW.is_vat_exempt := false;
      NEW.vat_rate      := 10;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_tenant_vat_on_insert ON public.tenants;
DROP TRIGGER IF EXISTS trg_sync_tenant_vat ON public.tenants;

CREATE TRIGGER trg_sync_tenant_vat
  BEFORE INSERT OR UPDATE OF legal_form ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.sync_tenant_vat();

DROP FUNCTION IF EXISTS public.set_tenant_vat_on_insert();
DROP FUNCTION IF EXISTS public.sync_tenant_vat_config();
