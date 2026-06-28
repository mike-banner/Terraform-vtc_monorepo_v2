-- 20260520120000_add_google_reviews_url.sql
-- Add google_reviews_url to tenants for smart feedback routing (SEO vs internal)

ALTER TABLE "public"."tenants"
ADD COLUMN IF NOT EXISTS "google_reviews_url" "text";
