import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import icon from "astro-icon";
import { defineConfig } from "astro/config";
import { lireSites } from "./sites.config.mjs";

// En build, PUBLIC_SITE/SITE_MAP viennent de l'environnement seulement : le .env local ne doit pas faire compiler
// en silence les sites d'une autre instance. En dev, le .env local suffit.
const isBuild = process.argv.includes("build"); // ponytail: détection par argv, suffisant pour `astro build`
// Seules ces deux clés sont lues, jamais tout le fichier : un process.loadEnvFile(".env") complet passait avant `.env.local`
// et faisait pointer le site de développement vers les adresses Supabase du .env (la base distante).
if (!isBuild)
  for (const cle of ["PUBLIC_SITE", "SITE_MAP"])
    for (const fichier of [".env.local", ".env"]) {
      if (process.env[cle] !== undefined || !existsSync(fichier)) continue;
      const m = readFileSync(fichier, "utf8").match(new RegExp(`^${cle}=(.*)$`, "m"));
      if (m) process.env[cle] = m[1].trim().replace(/^["']|["']$/g, "");
    }
const { defaultSite, siteMap, codes } = lireSites(process.env);
const racine = fileURLToPath(new URL("./src/sites/", import.meta.url));
for (const code of codes)
  if (!existsSync(`${racine}${code}/pages/index.astro`) || !existsSync(`${racine}${code}/config.ts`))
    throw new Error(`Site « ${code} » introuvable ou incomplet dans src/sites/ (pages/index.astro et config.ts attendus ; récupérer son contenu avant la compilation : docs/INSTANCES.md).`);

// Un site = sa landing et sa configuration (D-29 c) ; tunnels et pages fonctionnelles sont communs (src/pages/).
// Seuls les sites listés sont importés : rien d'un autre site n'entre dans la compilation (D-28 b).
// ponytail: un site ajouté en dev demande un redémarrage du serveur.
function sitesDeLInstance() {
  return {
    name: "vtc-sites",
    resolveId: (id) => (id === "virtual:vtc-sites" ? "\0virtual:vtc-sites" : null),
    load(id) {
      if (id !== "\0virtual:vtc-sites") return null;
      const j = JSON.stringify;
      return [
        ...codes.map((c, i) => `import config${i} from ${j(`/src/sites/${c}/config.ts`)};`),
        `export const siteMap = ${j(siteMap)};`,
        `export const defaultSite = ${j(defaultSite)};`,
        `export const configs = {${codes.map((c, i) => `${j(c)}: config${i}`).join(",")}};`,
        `export const landings = {${codes.map((c) => `${j(c)}: () => import(${j(`/src/sites/${c}/pages/index.astro`)})`).join(",")}};`,
      ].join("\n");
    },
  };
}

export default defineConfig({
  // INDISPENSABLE pour le multi-tenant
  output: "server",

  adapter: cloudflare(),

  integrations: [icon()],

  vite: {
    plugins: [tailwindcss(), sitesDeLInstance()],
  },
});
