import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { ZodType } from "zod";

// Resolver zod minimal : évite @hookform/resolvers.
// ponytail: erreurs à plat, clé "a.b" ; pour des champs imbriqués, utiliser register("a.b") et lire errors["a.b"].
export function zodResolver<T extends FieldValues>(schema: ZodType<T, any, any>): Resolver<T> {
  return async (values) => {
    const r = schema.safeParse(values);
    if (r.success) return { values: r.data, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const i of r.error.issues) {
      const k = i.path.join(".");
      if (!(k in errors)) errors[k] = { type: "validation", message: i.message };
    }
    return { values: {}, errors: errors as FieldErrors<T> };
  };
}
