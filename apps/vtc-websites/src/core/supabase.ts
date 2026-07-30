// src/lib/supabase.ts
import { createClient } from "@vtc/database";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "⚠️ Les variables d'environnement Supabase (PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY) sont manquantes.",
  );
}

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : new Proxy({} as any, {
      get(_, prop) {
        console.warn(`⚠️ Appel à Supabase [${String(prop)}] sans variables de configuration.`);
        
        const createFluentProxy = (): any => {
          return new Proxy(() => {}, {
            apply(target, thisArg, argumentsList) {
              return createFluentProxy();
            },
            get(target, key) {
              if (key === "then") {
                return (resolve: any) => resolve({ data: null, error: new Error("Supabase non configuré") });
              }
              return createFluentProxy();
            }
          });
        };

        return createFluentProxy();
      }
    });

