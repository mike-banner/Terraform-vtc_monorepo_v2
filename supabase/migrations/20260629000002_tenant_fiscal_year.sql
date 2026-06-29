-- 20260629000002_tenant_fiscal_year.sql
-- Mois de début d'exercice fiscal du tenant (1 = janvier, 7 = juillet, etc.).
-- Permet les exports CSV par exercice fiscal décalé.

ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS fiscal_year_start_month integer DEFAULT 1
  CHECK (fiscal_year_start_month BETWEEN 1 AND 12);

COMMENT ON COLUMN public.tenants.fiscal_year_start_month
IS 'Mois de début d''exercice fiscal (1–12). Défaut : 1 (janvier).';
