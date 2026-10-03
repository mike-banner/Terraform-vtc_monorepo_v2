import { supabase } from "@/lib/supabase/client";

const REASONS: Record<string, string> = {
  suspended: "Votre entreprise a été suspendue. Contactez le support.",
  inactivity: "Vous avez été déconnecté pour inactivité.",
  expired: "Votre session a expiré. Reconnectez-vous.",
};

/** Connexion démo : seulement si l'instance fournit les deux variables à la compilation (A-07). */
export function demoCredentials(env: { DEMO_EMAIL: string; DEMO_PASSWORD: string }) {
  return env.DEMO_EMAIL && env.DEMO_PASSWORD ? { email: env.DEMO_EMAIL, password: env.DEMO_PASSWORD } : null;
}

/** Seules les valeurs connues sont acceptées : le paramètre d'URL n'est jamais affiché tel quel. */
export function reasonMessage(reason: string | null): string | null {
  return reason && Object.hasOwn(REASONS, reason) ? REASONS[reason] : null;
}

export async function signIn(email: string, password: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return { ok: true };
  return {
    ok: false,
    message: error.message === "Invalid login credentials" ? "Email ou mot de passe incorrect." : "Connexion impossible, réessayez.",
  };
}
