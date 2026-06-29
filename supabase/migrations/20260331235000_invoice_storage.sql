-- 20260331235000_invoice_storage.sql
-- Add invoice storage fields to bookings

ALTER TABLE "public"."bookings"
ADD COLUMN IF NOT EXISTS "invoice_url" text,
ADD COLUMN IF NOT EXISTS "invoice_number" text,
ADD COLUMN IF NOT EXISTS "invoice_created_at" timestamptz;

-- Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_bookings_invoice_number ON bookings(invoice_number);
