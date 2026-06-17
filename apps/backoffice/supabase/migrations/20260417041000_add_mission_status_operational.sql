-- 20260417041000_add_mission_status_operational.sql
-- Add mission_note (technical logs) and mission_status (operational state)

-- 1. Create Mission Status Enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mission_status_enum') THEN
        CREATE TYPE "public"."mission_status_enum" AS ENUM ('to_validate', 'not_started', 'in_progress', 'completed');
    END IF;
END $$;

-- 2. Add columns to bookings
ALTER TABLE "public"."bookings"
ADD COLUMN IF NOT EXISTS "mission_note" text,
ADD COLUMN IF NOT EXISTS "mission_status" "public"."mission_status_enum" DEFAULT 'to_validate'::"public"."mission_status_enum";

-- 3. Initial backfill of mission_status based on core status
UPDATE "public"."bookings" SET "mission_status" = 'completed' WHERE "status" IN ('completed', 'paid');
UPDATE "public"."bookings" SET "mission_status" = 'to_validate' WHERE "status" = 'pending';
UPDATE "public"."bookings" SET "mission_status" = 'not_started' WHERE "status" IN ('accepted', 'accepted_pending_payment');
