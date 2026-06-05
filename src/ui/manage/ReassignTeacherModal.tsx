import { useState } from "react";
import { Modal } from "../common/Modal";
import { teacherImpact, reassignTeacher } from "../../domain/lifecycle";
import { removeTeacher } from "../../domain/projectEdit";
import type { Project, Teacher } from "../../domain/types";

/** Guided teacher removal (M18): show the footprint, then either reassign every
 * lesson to another teacher (no dangling reference) or remove anyway (drops the
 * teacher's solo lessons). */
export function ReassignTeacherModal({
  project,
  teacher,
  apply,
  onClose,
}: {
  project: Project;
  teacher: Teacher;
  apply: (p: Project) => void;
  onClose: () => void;
}) {
  const impact = teacherImpact(project, teacher.id);
  const others = project.teachers.filter((t) => t.id !== teacher.id);
  const [toId, setToId] = useState("");

  const reassignAndRemove = () => {
    if (!toId) return;
    apply(removeTeacher(reassignTeacher(project, teacher.id, toId), teacher.id));
    onClose();
  };
  const removeAnyway = () => {
    apply(removeTeacher(project, teacher.id));
    onClose();
  };

  return (
    <Modal onClose={onClose} label={`Remove ${teacher.name}`} maxWidth="max-w-lg">
      <div className="p-5">
        <h2 className="text-lg font-semibold">Remove {teacher.name}?</h2>
        <p className="mt-1 text-sm text-slate-600">
          {teacher.name} teaches <strong>{impact.placements}</strong> period
          {impact.placements === 1 ? "" : "s"} a week
          {impact.classTeacherOf.length > 0 && (
            <> and is class teacher of {impact.classTeacherOf.join(", ")}</>
          )}
          . Reassign their lessons to another teacher so nothing is left empty.
        </p>

        <label className="mt-4 block text-sm">
          <span className="text-slate-600">Reassign everything to</span>
          <select
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            aria-label="Reassign to"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
          >
            <option value="">— pick a teacher —</option>
            {others.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={removeAnyway}
            className="rounded border border-hard px-3 py-1 text-sm text-hard hover:bg-red-50"
          >
            Remove anyway
          </button>
          <button
            type="button"
            onClick={reassignAndRemove}
            disabled={!toId}
            className="rounded bg-indigo-600 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            Reassign &amp; remove
          </button>
        </div>
      </div>
    </Modal>
  );
}
