import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function checkOnboarding() {
  const { data: onboardings, error } = await supabase
    .from("onboarding")
    .select("id, profile_id, status, company_name, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching onboardings:", error);
    return;
  }

  console.log("--- ONBOARDINGS BREAKDOWN ---");
  for (const o of onboardings) {
    console.log(`Onboarding ID: ${o.id}`);
    console.log(`  - Profile ID: ${o.profile_id}`);
    console.log(`  - Status: ${o.status}`);
    console.log(`  - Company: ${o.company_name}`);
    console.log(`  - Created At: ${o.created_at}`);
    console.log("------------------------");
  }
}

checkOnboarding();
