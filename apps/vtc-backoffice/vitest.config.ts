import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx,mjs}"],
    setupFiles: ["src/test/setup.ts"],
  },
});
