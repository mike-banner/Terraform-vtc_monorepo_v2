// Seul lecteur de import.meta.env pour le code React (src/app, src/features, src/ui).
const e = import.meta.env;
export const env = {
  SUPABASE_URL: (e.PUBLIC_SUPABASE_URL as string | undefined) ?? "",
  SITE_URL: (e.PUBLIC_SITE_URL as string | undefined) ?? "",
  DEMO_EMAIL: (e.PUBLIC_DEMO_EMAIL as string | undefined) ?? "",
  DEMO_PASSWORD: (e.PUBLIC_DEMO_PASSWORD as string | undefined) ?? "",
};
