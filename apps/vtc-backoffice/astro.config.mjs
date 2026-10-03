// @ts-check
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  output: "server",
  // La barre de dev recouvre la barre de navigation basse (mobile) et intercepte les clics des tests.
  devToolbar: { enabled: false },
  adapter: cloudflare(),
  integrations: [
    react(),
  ],
  vite: {
    plugins: [tailwindcss()],
    // Dépendances des îlots client:only : les pré-déclarer évite une ré-optimisation à froid
    // en plein chargement (deux copies de React, « Invalid hook call » au premier rendu).
    optimizeDeps: {
      include: ["react-router-dom", "@tanstack/react-query", "@vtc/realtime", "lucide-react", "react-hook-form"],
    },
    // Suppression de l'alias react-dom/server.edge qui cause l'erreur "require is not defined"
  },
});
