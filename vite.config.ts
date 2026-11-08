import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "web",
  // Relative paths so the site works under any GitHub Pages address.
  base: "./",
  // .env.local lives in the project root, next to package.json.
  envDir: "..",
  plugins: [react()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
