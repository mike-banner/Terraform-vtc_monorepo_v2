-- 20260401190000_onboarding_update_policy.sql
-- Fix: Missing UPDATE policy for users on their own onboarding records

CREATE POLICY "onboarding_update_own" ON "public"."onboarding"
FOR UPDATE
USING (("profile_id" = "auth"."uid"()))
WITH CHECK (("profile_id" = "auth"."uid"()));

-- Also allow platform admins to update everything if needed (for later)
CREATE POLICY "onboarding_update_platform" ON "public"."onboarding"
FOR UPDATE
USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."platform_role" IS NOT NULL)))));
