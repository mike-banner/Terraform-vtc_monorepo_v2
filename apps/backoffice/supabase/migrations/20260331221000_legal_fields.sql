-- [MIGRATION] Refined legal fields for Bulletproof 2026 invoicing

-- 1. Create Legal Form Enum
DO $$ BEGIN
    CREATE TYPE public.legal_form_enum AS ENUM ('AUTO_ENTREPRENEUR', 'SASU', 'EURL', 'SARL', 'SAS', 'EI', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add columns to tenants
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS legal_form public.legal_form_enum DEFAULT 'AUTO_ENTREPRENEUR',
ADD COLUMN IF NOT EXISTS is_vat_exempt boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS rcs_number text,
ADD COLUMN IF NOT EXISTS vat_number text,
ADD COLUMN IF NOT EXISTS capital_social numeric(12,2);

-- 3. Add Consistency Constraint
-- Ensures that vat_number is NULL if vat_exempt is TRUE
ALTER TABLE public.tenants
DROP CONSTRAINT IF EXISTS vat_consistency_check;

ALTER TABLE public.tenants
ADD CONSTRAINT vat_consistency_check
CHECK (
  (is_vat_exempt = true AND vat_number IS NULL) OR
  (is_vat_exempt = false)
);

-- 4. Initial cleanup of previous migration attempts
ALTER TABLE public.tenants DROP COLUMN IF EXISTS legal_mentions;

COMMENT ON COLUMN public.tenants.is_vat_exempt IS 'Si vrai, déclenche la mention légale Art. 293 B du CGI sur les factures.';
