import { useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { serializeProject, suggestFilename } from "../../persistence/projectFile";
import { downloadText } from "../io/download";
import type { Project } from "../../domain/types";

type Variant = "storage-error" | "corrupt-data";

interface Props {
  variant: Variant;
  /** For the corrupt-data case we already hold the project in memory and can
   * back it up directly; for a storage error we re-read via a fresh attempt. */
  project?: Project | null;
}

const COPY: Record<Variant, { title: string; body: string }> = {
  "storage-error": {
    title: "We couldn't open your saved data",
    body: "Your timetable is stored in this browser, and it isn't responding right now. Your work is most likely still safe — try one of these:",
  },
  "corrupt-data": {
    title: "Your saved timetable looks incomplete",
    body: "We opened your saved data but part of it is missing. Download a backup first if you'd like to keep it, then start fresh:",
  },
};

export function RecoveryScreen({ variant, project }: Props) {
  const retryStorage = useProjectStore((s) => s.retryStorage);
  const readBackup = useProjectStore((s) => s.readBackup);
  const startFresh = useProjectStore((s) => s.startFresh);
  const [busy, setBusy] = useState<null | "retry" | "backup" | "fresh">(null);
  const [message, setMessage] = useState<string | null>(null);

  const copy = COPY[variant];

  async function handleBackup() {
    setBusy("backup");
    setMessage(null);
    try {
      const toSave = variant === "corrupt-data" ? project ?? null : await readBackup();
      if (!toSave) {
        setMessage("We still couldn't read your saved data to back it up. Try again, or start fresh.");
        return;
      }
      downloadText(suggestFilename(toSave), serializeProject(toSave), "application/json");
      setMessage("Backup downloaded. Keep this file safe — you can re-import it later.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRetry() {
    setBusy("retry");
    setMessage(null);
    await retryStorage();
    // If it failed again the screen re-renders with the same variant; tell the user.
    if (useProjectStore.getState().storageStatus === "error") {
      setMessage("Still no response. Try closing other tabs of this site, then try again.");
    }
    setBusy(null);
  }

  async function handleFresh() {
    setBusy("fresh");
    setMessage(null);
    await startFresh();
    setBusy(null);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{copy.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{copy.body}</p>

        <div className="mt-5 flex flex-col gap-3">
          {variant === "storage-error" && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={busy !== null}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy === "retry" ? "Trying…" : "Try again"}
            </button>
          )}
          <button
            type="button"
            onClick={handleBackup}
            disabled={busy !== null}
            className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === "backup" ? "Preparing…" : "Download a backup"}
          </button>
          <button
            type="button"
            onClick={handleFresh}
            disabled={busy !== null}
            className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === "fresh" ? "Starting…" : "Start fresh (clears saved data)"}
          </button>
        </div>

        {message && <p className="mt-4 text-sm text-slate-600">{message}</p>}

        <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-400">
          Tip: this can happen when the same site is open in another browser tab. Closing the
          other tabs often fixes it.
        </p>
      </div>
    </div>
  );
}
