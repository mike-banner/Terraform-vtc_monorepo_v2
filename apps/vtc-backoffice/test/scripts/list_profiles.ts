import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function listProfiles() {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, platform_role, tenant_role");

  if (error) {
    console.error(error);
    return;
  }

  console.log("Profiles found:", profiles.length);
  console.log(JSON.stringify(profiles, null, 2));
}

listProfiles();
