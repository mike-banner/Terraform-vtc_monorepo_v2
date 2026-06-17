-- 20260417050500_update_admin_view.sql
-- Update admin_bookings_full_view to include mission columns (mission_status, mission_note)

DROP VIEW IF EXISTS "public"."admin_bookings_full_view";

CREATE VIEW "public"."admin_bookings_full_view" AS
 SELECT "b"."id",
    "b"."created_at",
    "b"."pickup_time",
    "b"."pickup_address",
    "b"."dropoff_address",
    COALESCE("c"."first_name", 'Client'::"text") AS "display_customer_first_name",
    "c"."last_name" AS "display_customer_last_name",
    "c"."email" AS "display_customer_email",
    "c"."phone" AS "display_customer_phone",
    "c"."city" AS "display_customer_city",
    "c"."postal_code" AS "display_customer_postal_code",
    "b"."total_amount",
    "b"."status",
    "b"."mission_status",
    "b"."mission_note",
    "ot"."name" AS "original_tenant_name",
    "ot"."primary_domain" AS "original_tenant_domain",
    "ct"."name" AS "current_tenant_name"
   FROM ((("public"."bookings" "b"
     LEFT JOIN "public"."customers" "c" ON (("c"."id" = "b"."customer_id")))
     LEFT JOIN "public"."tenants" "ot" ON (("ot"."id" = "b"."original_tenant_id")))
     LEFT JOIN "public"."tenants" "ct" ON (("ct"."id" = "b"."current_tenant_id")));
