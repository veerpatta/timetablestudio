import { useProjectStore } from "../../store/projectStore";
import { useEditorStore } from "../../store/editorStore";

/** Top-bar selector for the active timetable draft (e.g. original vs a created
 * option vs a filled-in draft). Switching resets the editor's undo history. */
export function DraftSwitcher() {
  const project = useProjectStore((s) => s.project);
  const setActiveTimetable = useProjectStore((s) => s.setActiveTimetable);
  const deleteTimetable = useProjectStore((s) => s.deleteTimetable);
  if (!project || project.timetables.length === 0) return null;

  return (
    <div className="flex items-center gap-1 text-sm">
      <label className="sr-only" htmlFor="draft-switcher">
        Timetable draft
      </label>
      <select
        id="draft-switcher"
        value={project.activeTimetableId ?? ""}
        onChange={(e) => {
          setActiveTimetable(e.target.value);
          useEditorStore.setState({ past: [], future: [] });
        }}
        className="max-w-[12rem] rounded border border-slate-300 px-2 py-1"
      >
        {project.timetables.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {project.timetables.length > 1 && (
        <button
          type="button"
          title="Delete this draft"
          aria-label="Delete this draft"
          onClick={() => {
            if (project.activeTimetableId) deleteTimetable(project.activeTimetableId);
            useEditorStore.setState({ past: [], future: [] });
          }}
          className="rounded border border-slate-300 px-2 py-1 text-slate-400 hover:text-hard"
        >
          ✕
        </button>
      )}
    </div>
  );
}
