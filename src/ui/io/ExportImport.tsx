import { useMemo, useState, type ChangeEvent } from "react";
import { useProjectStore } from "../../store/projectStore";
import { useEditorStore } from "../../store/editorStore";
import { exportLegacyRawData } from "../../domain/legacyExport";
import { importLegacyRawData } from "../../domain/legacyImport";
import { normalizeProject } from "../../domain/requirements";
import { serializeProject, deserializeProject, suggestFilename } from "../../persistence/projectFile";
import { downloadText, copyText, readFileText } from "./download";

export function ExportImport({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const setProject = useProjectStore((s) => s.setProject);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const rawData = useMemo(() => {
    if (!project || !project.activeTimetableId) return "";
    try {
      return exportLegacyRawData(project, project.activeTimetableId);
    } catch (e) {
      return `# export error: ${(e as Error).message}`;
    }
  }, [project]);

  if (!project) return null;

  const afterImport = (next: Parameters<typeof setProject>[0], label: string) => {
    setProject(next);
    useEditorStore.setState({ past: [], future: [], selection: null });
    setInfo(`Imported ${label}.`);
    setError(null);
  };

  const onJsonFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      afterImport(deserializeProject(await readFileText(file)), `project "${file.name}"`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      e.target.value = "";
    }
  };

  const onLegacyFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = importLegacyRawData(await readFileText(file), file.name.replace(/\.[^.]+$/, ""));
      afterImport(normalizeProject(imported, imported.activeTimetableId!), `legacy rawData "${file.name}"`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="modal-overlay fixed inset-0 z-10 flex items-start justify-center overflow-auto bg-black/30 p-6">
      <div className="modal-card w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold">Export / Import</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </header>

        <div className="space-y-4 p-4">
          {error && <p className="rounded bg-red-50 px-3 py-2 text-xs text-hard">⚠ {error}</p>}
          {info && <p className="rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{info}</p>}

          <section>
            <h3 className="text-sm font-semibold">Legacy rawData (for the existing viewer)</h3>
            <p className="mb-2 text-xs text-slate-500">
              Copy/paste into the viewer, or download as a file.
            </p>
            <textarea
              readOnly
              value={rawData}
              className="h-32 w-full rounded border border-slate-300 p-2 font-mono text-[11px]"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  setCopied(await copyText(rawData));
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="rounded bg-slate-800 px-3 py-1 text-sm text-white"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
              <button
                type="button"
                onClick={() => downloadText("vpps.rawdata.txt", rawData)}
                className="rounded border border-slate-300 px-3 py-1 text-sm"
              >
                Download .txt
              </button>
            </div>
          </section>

          <section className="border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold">Project backup (JSON)</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => downloadText(suggestFilename(project), serializeProject(project), "application/json")}
                className="rounded bg-indigo-600 px-3 py-1 text-sm text-white"
              >
                Download {suggestFilename(project)}
              </button>
              <label className="cursor-pointer rounded border border-slate-300 px-3 py-1 text-sm">
                Import JSON…
                <input type="file" accept=".json,.ttproj.json,application/json" onChange={onJsonFile} className="hidden" />
              </label>
              <label className="cursor-pointer rounded border border-slate-300 px-3 py-1 text-sm">
                Import legacy rawData…
                <input type="file" accept=".txt,.csv,text/plain" onChange={onLegacyFile} className="hidden" />
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Importing replaces the current project (export a backup first if unsure).
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
