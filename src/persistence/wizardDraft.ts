// Autosave for the setup wizard's in-progress input (M13). Kept OUT of the
// IndexedDB project store (that's for finished projects) — a tiny localStorage
// draft so a refresh mid-setup doesn't lose what was typed. All storage still
// lives in persistence/ (AGENTS §3). Best-effort: never throws.

const KEY = "timetable-studio:wizard-draft";

export function saveWizardDraft(draft: unknown): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* storage full / unavailable — losing a draft is non-fatal */
  }
}

export function loadWizardDraft<T>(): T | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearWizardDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
