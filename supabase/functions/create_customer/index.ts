import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const body = await req.json();

  const { tenant_id, email, first_name, last_name, phone } = body;

  const { data, error } = await supabase
    .from("customers")
    .upsert(
      {
        tenant_id,
        email,
        first_name,
        last_name,
        phone,
      },
      { onConflict: "tenant_id,email" },
    )
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify(error), { status: 500 });
  }

  return new Response(JSON.stringify(data));
});
