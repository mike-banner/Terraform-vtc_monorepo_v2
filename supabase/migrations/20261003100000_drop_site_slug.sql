-- Le site d'un tenant est choisi par son domaine (SITE_MAP à la compilation, ADR 0003) et le tenant par
-- tenants.primary_domain : la colonne site_slug n'est lue nulle part et n'existe déjà plus en production.
-- Sans effet là où elle est absente ; retire aussi sa contrainte d'unicité en local.
ALTER TABLE public.tenants DROP COLUMN IF EXISTS site_slug;
