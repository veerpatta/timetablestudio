// Cross-session UI preferences (M14): the once-only guided-tour flag. A global
// "first run" marker (not per-project), replayable from Settings. localStorage,
// best-effort — kept in persistence/ (AGENTS §3). Never throws.

const TOUR_KEY = "timetable-studio:tour-seen";

export function getTourSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === "1";
  } catch {
    return false;
  }
}

export function setTourSeen(seen: boolean): void {
  try {
    if (seen) localStorage.setItem(TOUR_KEY, "1");
    else localStorage.removeItem(TOUR_KEY);
  } catch {
    /* ignore */
  }
}
