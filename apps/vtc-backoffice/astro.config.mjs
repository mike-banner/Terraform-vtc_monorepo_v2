// @ts-check
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  integrations: [
    react(),
  ],
  vite: {
    plugins: [tailwindcss()],
    // Suppression de l'alias react-dom/server.edge qui cause l'erreur "require is not defined"
  },
});
