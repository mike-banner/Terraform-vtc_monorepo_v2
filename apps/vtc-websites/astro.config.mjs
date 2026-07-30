import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import icon from "astro-icon";
import { defineConfig } from "astro/config";

export default defineConfig({
  // INDISPENSABLE pour le multi-tenant
  output: "server",

  adapter: cloudflare(),

  integrations: [icon()],

  vite: {
    plugins: [tailwindcss()],
  },
});
