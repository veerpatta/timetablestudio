// Global Vitest setup. Runs for every test file.
// jest-dom matchers are only meaningful under jsdom; guard so Node-env
// tests (domain/ and solver/ purity) don't pull in DOM-dependent code.
if (typeof document !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
  // Default the first-run guided tour to "already seen" so it doesn't overlay
  // every App test (M14). The dedicated tour test opts back in explicitly.
  try {
    localStorage.setItem("timetable-studio:tour-seen", "1");
  } catch {
    /* no localStorage in this environment */
  }
}
