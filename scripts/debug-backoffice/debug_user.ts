import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function checkSpecificUser(email: string) {
  console.log(`Checking status for: ${email}`);

  const {
    data: { users },
    error: authError,
  } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error("Error listing users:", authError);
    return;
  }

  const user = users.find((u) => u.email === email);

  if (!user) {
    console.log("User not found in auth.users");
    return;
  }

  console.log(`Auth User ID: ${user.id}`);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Error fetching profile:", profileError);
    return;
  }

  console.log("--- Profile Details ---");
  console.log(JSON.stringify(profile, null, 2));
}

const emailToCheck = process.argv[2] || "mike.webfree@gmail.com";
checkSpecificUser(emailToCheck);
