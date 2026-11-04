/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Web Worker support: Vite handles `new Worker(new URL(...), { type: "module" })`
// out of the box; no extra plugin needed.
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    setupFiles: ["./src/test/setup.ts"],
    // Default to Node so domain/ and solver/ purity is self-policing
    // (AGENTS.md A3). UI tests run in jsdom (Vitest 4+ uses projects instead
    // of environmentMatchGlobs).
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          exclude: ["src/ui/**", "**/*.dom.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/ui/**/*.{test,spec}.{ts,tsx}", "src/**/*.dom.test.{ts,tsx}"],
        },
      },
    ],
  },
});