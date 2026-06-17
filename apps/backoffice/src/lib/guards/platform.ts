// src/lib/guards/platform.ts
import { createAdminClient } from "../supabase/server";

const PLATFORM_ROLES = ["super_admin", "platform_staff"];

export async function requirePlatformAdmin(profile: any) {
  if (!profile?.id) {
    throw new Error("Unauthorized");
  }

  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("platform_role")
    .eq("id", profile.id)
    .maybeSingle();

  if (error || !data || !PLATFORM_ROLES.includes(data.platform_role)) {
    throw new Error("Unauthorized");
  }

  return true;
}
