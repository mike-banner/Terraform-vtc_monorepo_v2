import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function checkUsers() {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, platform_role, tenant_id, tenant_role");

  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }

  console.log("--- PROFILES BREAKDOWN ---");
  for (const p of profiles) {
    const isPlatformAdmin = ["super_admin", "platform_staff"].includes(
      p.platform_role as string,
    );
    const isTenantUser = !!p.tenant_id;

    console.log(`User ID: ${p.id}`);
    console.log(
      `  - Platform Role: ${p.platform_role || "none"} ${isPlatformAdmin ? "(ADMIN)" : ""}`,
    );
    console.log(`  - Tenant ID: ${p.tenant_id || "none"}`);
    console.log(
      `  - Tenant Role: ${p.tenant_role || "none"} ${isTenantUser ? "(TENANT)" : ""}`,
    );
    console.log("------------------------");
  }
}

checkUsers();
