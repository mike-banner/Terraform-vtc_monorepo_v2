import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClientOptions } from "@supabase/supabase-js";
import { createServerClient as createSsrServerClient, createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import ws from "ws";

// Le constructeur de `ws` n'a pas exactement la signature attendue par
// supabase-js (WebSocketLikeConstructor) : le cast est nécessaire, pas cosmétique.
const wsTransport = ws as unknown as NonNullable<SupabaseClientOptions<"public">["realtime"]>["transport"];

export function createClient(
  supabaseUrl: string,
  supabaseKey: string,
  options?: SupabaseClientOptions<"public">
) {
  return createSupabaseClient<Database>(supabaseUrl, supabaseKey, {
    ...options,
    realtime: {
      transport: wsTransport,
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
      transport: wsTransport,
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
