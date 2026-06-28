-- Migration: Add site_slug to tenants
ALTER TABLE IF EXISTS public.tenants
ADD COLUMN IF NOT EXISTS site_slug text UNIQUE;

-- Commentaire pour documentation
COMMENT ON COLUMN public.tenants.site_slug IS 'Slug identifiant le dossier de design dans src/sites/';

-- Update du tenant de test si nécessaire
-- UPDATE public.tenants SET site_slug = 'demo' WHERE id = '5750a0b3-4c6c-4782-b137-830a49e32249';
