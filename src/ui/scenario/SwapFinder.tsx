import { useMemo } from "react";
import { useEditorStore } from "../../store/editorStore";
import { legalSwaps } from "../../domain/scenario";
import type { PlacementRef } from "../../domain/edit";
import type { Project, Timetable } from "../../domain/types";

/** "Show legal swaps" for the selected lesson — every listed exchange keeps hard
 * conflicts at 0 (the everyday "a teacher asked to switch" operation). */
export function SwapFinder({ project, timetable }: { project: Project; timetable: Timetable }) {
  const selection = useEditorStore((s) => s.selection);
  const doSwap = useEditorStore((s) => s.swap);

  const subjectName = useMemo(() => new Map(project.subjects.map((s) => [s.id, s.name])), [project.subjects]);
  const teacherName = useMemo(() => new Map(project.teachers.map((t) => [t.id, t.name])), [project.teachers]);

  const labelFor = (ref: PlacementRef): string => {
    const a = project.activities.find((x) => x.id === ref.activityId);
    const base =
      a?.kind === "lesson"
        ? `${subjectName.get(a.subjectId) ?? a.subjectId} (${a.teacherIds.map((t) => teacherName.get(t) ?? t).join(" / ")})`
        : a?.kind === "block"
          ? a.name
          : "(empty)";
    return `${base} · ${ref.day} P${ref.period}`;
  };

  const swaps = useMemo(
    () => (selection ? legalSwaps(project, timetable, selection) : []),
    [project, timetable, selection],
  );

  return (
    <section className="rounded border border-slate-200 bg-white">
      <header className="border-b border-slate-200 px-3 py-2">
        <h2 className="text-sm font-semibold">Swap finder</h2>
      </header>
      {!selection ? (
        <p className="px-3 py-2 text-xs text-slate-500">Click a lesson in the grid to see conflict-free swaps.</p>
      ) : (
        <div className="px-3 py-2 text-xs">
          <p className="mb-2 text-slate-600">
            Swaps for <span className="font-medium">{labelFor(selection)}</span>:
          </p>
          {swaps.length === 0 ? (
            <p className="text-slate-400">No conflict-free swaps for this lesson.</p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-auto">
              {swaps.map((s) => (
                <li key={`${s.with.activityId}#${s.with.day}#${s.with.period}`}>
                  <button
                    type="button"
                    onClick={() => doSwap(s.ref, s.with)}
                    className="w-full rounded border border-slate-200 px-2 py-1 text-left hover:bg-sky-50"
                  >
                    ⇄ {labelFor(s.with)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
