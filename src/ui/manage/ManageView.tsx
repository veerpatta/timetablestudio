// "Setup" view (C1): the place a non-technical user adds/removes/renames teachers,
// subjects and classes, and edits the school day. All edits flow through the single
// store path (undoable + persisted). Sub-tabs keep each list focused.

import { useState } from "react";
import { referencesOf } from "../../domain/references";
import type { Project, Timetable } from "../../domain/types";
import { useProjectStore } from "../../store/projectStore";
import { AssignmentsView } from "./AssignmentsView";
import { EntityManager } from "./EntityManager";
import { PeriodManager } from "./PeriodManager";

type Section = "teachers" | "subjects" | "classes" | "assignments" | "periods";

export function ManageView({ project, timetable }: { project: Project; timetable: Timetable }): React.ReactElement {
  const store = useProjectStore();
  const [section, setSection] = useState<Section>("teachers");
  const profile =
    project.profiles.find((p) => p.id === timetable.profileId) ?? project.profiles[0]!;

  const tab = (s: Section, label: string) => (
    <button
      onClick={() => setSection(s)}
      className={`rounded px-3 py-1 text-sm ${section === s ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-700"}`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1">
        {tab("teachers", "Teachers")}
        {tab("subjects", "Subjects")}
        {tab("classes", "Classes")}
        {tab("assignments", "Who teaches what")}
        {tab("periods", "School day")}
      </div>

      {section === "teachers" && (
        <EntityManager
          kind="teacher"
          title="Teachers"
          noun="teacher"
          items={[...project.teachers].sort((a, b) => a.name.localeCompare(b.name)).map((t) => ({ id: t.id, name: t.name }))}
          impactOf={(id) => referencesOf(project, "teacher", id)}
          onAdd={(name) => store.addTeacher(name)}
          onRename={(id, name) => store.renameTeacher(id, name)}
          onRemove={(id, reassignTo) => store.removeTeacher(id, reassignTo)}
        />
      )}
      {section === "subjects" && (
        <EntityManager
          kind="subject"
          title="Subjects"
          noun="subject"
          items={[...project.subjects].sort((a, b) => a.name.localeCompare(b.name)).map((s) => ({ id: s.id, name: s.name }))}
          impactOf={(id) => referencesOf(project, "subject", id)}
          onAdd={(name) => store.addSubject(name)}
          onRename={(id, name) => store.renameSubject(id, name)}
          onRemove={(id) => store.removeSubject(id)}
        />
      )}
      {section === "classes" && (
        <EntityManager
          kind="class"
          title="Classes"
          noun="class"
          items={project.classes.map((c) => ({ id: c.id, name: c.name }))}
          impactOf={(id) => referencesOf(project, "class", id)}
          onAdd={(name) => store.addClass(name)}
          onRename={(id, name) => store.renameClass(id, name)}
          onRemove={(id) => store.removeClass(id)}
        />
      )}
      {section === "assignments" && <AssignmentsView project={project} />}
      {section === "periods" && (
        <PeriodManager
          profile={profile}
          onEdit={(slot, patch) => store.editPeriod(slot, patch)}
          onAdd={(label) => store.addPeriod(label)}
          onRemove={(slot) => store.removePeriod(slot)}
        />
      )}
    </div>
  );
}
