import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function checkSpecificEmail(email: string) {
  const {
    data: { users },
    error,
  } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error(error);
    return;
  }

  console.log("Total users in Auth:", users.length);
  const found = users.find((u) => u.email === email);
  if (found) {
    console.log("Found User:", found.id, found.email);
  } else {
    console.log("User not found by email:", email);
    console.log("Emails present:", users.map((u) => u.email).join(", "));
  }
}

checkSpecificEmail("mike.webfree@gmail.com");
