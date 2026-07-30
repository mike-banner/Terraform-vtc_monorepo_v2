/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
    profile: {
      id: string;
      tenant_id: string | null;
      platform_role: string | null;
      tenant_role: "owner" | "manager" | "driver" | "pending" | null;
      first_name: string | null;
      last_name: string | null;
    } | null;
    supabase: import("@supabase/supabase-js").SupabaseClient;
  }
}
