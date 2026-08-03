import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function syncSiteConfig() {
  const copy = () => {
    mkdirSync(resolve("public/data"), { recursive: true });
    copyFileSync(resolve("config/site.json"), resolve("public/data/site.json"));
  };
  return { name: "sync-site-config", buildStart: copy, configureServer: copy };
}

export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react(), syncSiteConfig()],
  build: { outDir: "dist", sourcemap: true },
});
