import { createClient as createSupabaseClient, SupabaseClientOptions } from "@supabase/supabase-js";
import { createServerClient as createSsrServerClient, createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import ws from "ws";

export function createClient(
  supabaseUrl: string,
  supabaseKey: string,
  options?: SupabaseClientOptions<"public">
) {
  return createSupabaseClient<Database>(supabaseUrl, supabaseKey, {
    ...options,
    realtime: {
      transport: ws,
      ...options?.realtime,
    },
  });
}

export function createServerClient<T = any>(
  supabaseUrl: string,
  supabaseKey: string,
  options: any
) {
  return createSsrServerClient<T>(supabaseUrl, supabaseKey, {
    ...options,
    realtime: {
      transport: ws,
      ...options?.realtime,
    },
  });
}

export function createBrowserClient<T = any>(
  supabaseUrl: string,
  supabaseKey: string,
  options?: any
) {
  return createSsrBrowserClient<T>(supabaseUrl, supabaseKey, options);
}
