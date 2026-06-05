import { useState } from "react";
import { useEditorStore } from "../../store/editorStore";
import { withClearedScope, type RegenScope } from "../../domain/scenario";
import { runSolver } from "../solverui/runSolver";
import type { Project } from "../../domain/types";

/** Targeted regenerate: freeze everything except a chosen class/teacher/subject
 * and re-solve only that. Runs through the worker on a scope-cleared project, so
 * only the unfrozen scope's cells change. */
export function RegenerateControl({ project, timetableId }: { project: Project; timetableId: string }) {
  const replace = useEditorStore((s) => s.replaceActivePlacements);
  const [kind, setKind] = useState<RegenScope["kind"]>("class");
  const [id, setId] = useState("");
  const [running, setRunning] = useState(false);
  const [seed, setSeed] = useState(1);
  const [note, setNote] = useState<string | null>(null);

  const options =
    kind === "class"
      ? project.classes.map((c) => ({ id: c.id, name: c.name }))
      : kind === "teacher"
        ? project.teachers.map((t) => ({ id: t.id, name: t.name }))
        : project.subjects.map((s) => ({ id: s.id, name: s.name }));

  const run = async () => {
    if (!id) return;
    setRunning(true);
    setNote(null);
    const cleared = withClearedScope(project, timetableId, { kind, id } as RegenScope);
    try {
      const done = await runSolver({ project: cleared, timetableId, mode: "complete", seed, maxMillis: 5000 }).promise;
      setSeed((s) => s + 1);
      replace(done.placements);
      setNote(
        done.complete
          ? `Regenerated ${id}. Only its cells changed.`
          : `Regenerated ${id}, but couldn't refit every period — try again or pick a smaller scope.`,
      );
    } catch {
      setNote("Couldn't regenerate just now.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-slate-600">Regenerate just one</span>
      <select
        value={kind}
        onChange={(e) => {
          setKind(e.target.value as RegenScope["kind"]);
          setId("");
        }}
        aria-label="Scope type"
        className="rounded border border-slate-300 px-2 py-1"
      >
        <option value="class">class</option>
        <option value="teacher">teacher</option>
        <option value="subject">subject</option>
      </select>
      <select value={id} onChange={(e) => setId(e.target.value)} aria-label="Scope" className="rounded border border-slate-300 px-2 py-1">
        <option value="">— pick —</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={run}
        disabled={!id || running}
        className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
      >
        {running ? "Working…" : "Regenerate"}
      </button>
      {note && <span className="text-xs text-slate-500">{note}</span>}
    </div>
  );
}
