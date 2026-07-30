import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function checkUserById(id: string) {
  const {
    data: { user },
    error,
  } = await supabase.auth.admin.getUserById(id);
  if (error) {
    console.error(error);
    return;
  }
  console.log("User Email:", user?.email);
  console.log("User Metadata:", user?.user_metadata);
}

checkUserById("95879b16-f871-4bb6-85d8-8058c575043f");
