// supabase.functions.invoke() lève un FunctionsHttpError dont `message` est
// toujours générique ("Edge Function returned a non-2xx status code") : le corps
// de la réponse, qui porte le message métier, n'est lisible que via err.context.
// Sans ce helper, un refus explicite de l'edge function s'affiche à l'utilisateur
// comme une erreur technique opaque.
export async function functionErrorMessage(err: any, fallback: string): Promise<string> {
  const body = err?.context;
  if (body && typeof body.json === "function") {
    try {
      const parsed = await body.json();
      if (parsed?.message) return parsed.message;
      if (parsed?.error) return parsed.error;
    } catch {
      // Corps non-JSON (texte brut renvoyé par les guards plus anciens).
      try {
        const text = await body.text?.();
        if (text) return text;
      } catch { /* on retombe sur le fallback */ }
    }
  }
  return err?.message || fallback;
}
