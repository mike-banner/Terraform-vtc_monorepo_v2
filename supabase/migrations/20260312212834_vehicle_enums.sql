-- =========================
-- VEHICLE ENUMS
-- =========================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'vehicle_category_enum'
  ) THEN
    CREATE TYPE vehicle_category_enum AS ENUM (
      'berline',
      'van',
      'suv',
      'minibus',
      'luxury'
    );
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'vehicle_status_enum'
  ) THEN
    CREATE TYPE vehicle_status_enum AS ENUM (
      'active',
      'inactive',
      'maintenance'
    );
  END IF;
END $$;


-- =========================
-- ALTER VEHICLES
-- =========================

ALTER TABLE public.vehicles
ALTER COLUMN category
TYPE vehicle_category_enum
USING category::vehicle_category_enum;


ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS status vehicle_status_enum
NOT NULL DEFAULT 'active';
