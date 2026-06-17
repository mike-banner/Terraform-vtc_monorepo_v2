-- [MIGRATION] Add logo_url to tenants for branding and invoices
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS logo_url text;

-- Update the admin view to include the logo if needed (optional but good for consistency)
-- (No change needed to admin_tenants_overview if it's dynamic)
