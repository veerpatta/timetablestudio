// Global Vitest setup. Runs for every test file.
// jest-dom matchers are only meaningful under jsdom; guard so Node-env
// tests (domain/ and solver/ purity) don't pull in DOM-dependent code.
if (typeof document !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
}
