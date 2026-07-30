import { createClient } from "@vtc/database";

export function createAdminClient(locals?: App.Locals | Record<string, unknown>) {
  const runtime = (locals as any)?.runtime?.env;
  const key =
    runtime?.SUPABASE_SERVICE_ROLE_KEY ??
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  return createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    key,
  );
}
