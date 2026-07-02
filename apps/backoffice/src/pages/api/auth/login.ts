import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  try {
    const formData = await request.formData();
    const email = formData.get("email")?.toString();
    const password = formData.get("password")?.toString();

    if (!email || !password) {
      return redirect("/login?error=" + encodeURIComponent("Email et mot de passe requis."));
    }

    // locals.supabase is the server client configured with cookies in middleware.ts
    const { error } = await locals.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return redirect("/login?error=" + encodeURIComponent(error.message));
    }

    return redirect("/dashboard");
  } catch (err: any) {
    return redirect("/login?error=" + encodeURIComponent(err.message || "Erreur technique"));
  }
};
