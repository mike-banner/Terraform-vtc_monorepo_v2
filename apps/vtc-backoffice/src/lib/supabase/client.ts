import { createBrowserClient } from "@vtc/database";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createBrowserClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
);
