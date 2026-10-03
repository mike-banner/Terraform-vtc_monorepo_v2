import { supabase } from "@/lib/supabase/client";
import { functionErrorMessage } from "@/lib/function-error";

export class AppError extends Error {
  code?: string;
  details?: string;
  constructor(message: string, code?: string, details?: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

// Messages FR par SQLSTATE ; les autres codes gardent le message métier levé par la RPC.
const BY_CODE: Record<string, string> = {
  "42501": "Action non autorisée.",
  P0002: "Élément introuvable.",
};

/** Appel de RPC : lève AppError (message FR) au lieu de renvoyer { error }. */
export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) throw new AppError(BY_CODE[error.code] ?? error.message, error.code, error.details ?? undefined);
  return data as T;
}

/** Appel d'Edge Function : lève AppError avec le message métier du corps de réponse. */
export async function invokeFn<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new AppError(await functionErrorMessage(error, "Une erreur est survenue."));
  return data as T;
}
