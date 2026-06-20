/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Web Worker support: Vite handles `new Worker(new URL(...), { type: "module" })`
// out of the box; no extra plugin needed.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
    strictPort: !process.env.PORT,
  },
  build: {
    target: "es2021",
  },
  worker: {
    format: "es",
  },
  test: {
    globals: true,
    // Default to Node so domain/ and solver/ purity is self-policing
    // (AGENTS.md §3). UI tests opt into jsdom per-glob below.
    environment: "node",
    environmentMatchGlobs: [
      ["src/ui/**", "jsdom"],
      ["**/*.dom.test.{ts,tsx}", "jsdom"],
    ],
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
