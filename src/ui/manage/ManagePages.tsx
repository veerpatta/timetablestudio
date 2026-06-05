import { useProjectStore } from "../../store/projectStore";
import {
  addClass,
  removeClass,
  addTeacher,
  setTeacher,
  removeTeacher,
  setSchoolName,
  setActiveProfile,
  addBlock,
  removeBlock,
} from "../../domain/projectEdit";
import type { Day, Project, SchoolClass } from "../../domain/types";
import { useUiStore } from "../../store/uiStore";
import { Chips } from "../common/Chips";
import { Glossary } from "../common/Glossary";
import { BlockForm } from "./BlockForm";

const ALL_DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function inferGroup(name: string): SchoolClass["group"] {
  const n = Number(name.match(/(\d+)/)?.[1] ?? NaN);
  if (n >= 1 && n <= 5) return "primary";
  if (n >= 11) return "senior";
  return "middle";
}

function PageShell({ title, subtitle, glossary, children }: { title: string; subtitle?: string; glossary?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl p-4">
      <h2 className="text-lg font-semibold">{title}{glossary}</h2>
      {subtitle && <p className="mb-3 text-sm text-slate-500">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function useApply(): [Project, (p: Project) => void] {
  const project = useProjectStore((s) => s.project)!;
  const setProject = useProjectStore((s) => s.setProject);
  return [project, setProject];
}

export function ClassesPage() {
  const [project, apply] = useApply();
  return (
    <PageShell title="Classes" subtitle="Add a class and press Enter. The group (primary / middle / senior) is inferred from the number.">
      <Chips
        ariaLabel="Add a class"
        placeholder="e.g. Class 7, Class 11 Science…"
        values={project.classes.map((c) => c.name)}
        onAdd={(name) => apply(addClass(project, name, inferGroup(name)))}
        onRemove={(name) => {
          const cls = project.classes.find((c) => c.name === name);
          if (cls) apply(removeClass(project, cls.id));
        }}
      />
      <p className="mt-2 text-xs text-slate-400">{project.classes.length} classes.</p>
    </PageShell>
  );
}

export function TeachersPage() {
  const [project, apply] = useApply();
  const subjectSuggestions = project.subjects.map((s) => s.name);
  return (
    <PageShell title="Teachers" subtitle="Each teacher and the subjects they can teach. Add subjects as chips.">
      <ul className="space-y-3">
        {project.teachers.map((t) => (
          <li key={t.id} className="rounded border border-slate-200 p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-medium">{t.name}</span>
              <button type="button" onClick={() => apply(removeTeacher(project, t.id))} aria-label={`Remove ${t.name}`} className="text-slate-400 hover:text-hard">
                ✕
              </button>
            </div>
            <Chips
              ariaLabel={`Subjects for ${t.name}`}
              placeholder="add a subject…"
              suggestions={subjectSuggestions}
              values={t.subjects}
              onAdd={(s) => apply(setTeacher(project, t.id, { subjects: [...t.subjects, s] }))}
              onRemove={(s) => apply(setTeacher(project, t.id, { subjects: t.subjects.filter((x) => x !== s) }))}
            />
          </li>
        ))}
      </ul>
      <Chips
        ariaLabel="Add a teacher"
        placeholder="New teacher name, then Enter"
        values={[]}
        onAdd={(name) => apply(addTeacher(project, name))}
        onRemove={() => {}}
      />
    </PageShell>
  );
}

export function SettingsPage() {
  const [project, apply] = useApply();
  const startTour = useUiStore((s) => s.startTour);
  const profile = project.profiles.find(
    (p) => p.id === project.timetables.find((t) => t.id === project.activeTimetableId)?.profileId,
  );
  const days = profile?.days ?? [];
  const periods = profile?.periods.length ?? 6;
  const toggleDay = (d: Day) => {
    const next = days.includes(d)
      ? days.filter((x) => x !== d)
      : ALL_DAYS.filter((x) => days.includes(x) || x === d);
    apply(setActiveProfile(project, { days: next }));
  };
  return (
    <PageShell title="Settings" subtitle="School name, teaching days and periods per day.">
      <label className="block">
        <span className="text-sm text-slate-600">School name</span>
        <input
          value={project.school.name}
          onChange={(e) => apply(setSchoolName(project, e.target.value))}
          className="mt-1 w-full max-w-sm rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <div className="mt-4">
        <span className="text-sm text-slate-600">Teaching days</span>
        <div className="mt-1 flex flex-wrap gap-1">
          {ALL_DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              className={`rounded px-3 py-1 text-sm ${days.includes(d) ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
      <label className="mt-4 block">
        <span className="text-sm text-slate-600">Periods per day</span>
        <input
          type="number"
          min={1}
          max={12}
          value={periods}
          onChange={(e) => apply(setActiveProfile(project, { periods: Math.max(1, Math.min(12, Number(e.target.value))) }))}
          className="mt-1 block w-20 rounded border border-slate-300 px-2 py-1"
        />
      </label>
      <div className="mt-6 border-t border-slate-100 pt-4">
        <button type="button" onClick={startTour} className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50">
          Replay the guided tour
        </button>
      </div>
    </PageShell>
  );
}

export function BlocksPage() {
  const [project, apply] = useApply();
  const profile = project.profiles.find(
    (p) => p.id === project.timetables.find((t) => t.id === project.activeTimetableId)?.profileId,
  );
  const maxPeriods = profile?.periods.length ?? 6;
  const blocks = project.activities.filter((a) => a.kind === "block");
  const reqByBlock = new Map(project.requirements.blocks.map((b) => [b.blockActivityId, b]));
  return (
    <PageShell
      title="Blocks"
      glossary={<Glossary term="block" />}
      subtitle="Multi-class blocks like ELGA: several classes regroup together and a set of teachers are occupied for the whole block."
    >
      <ul className="mb-4 space-y-2">
        {blocks.length === 0 && <li className="text-sm text-slate-400">No blocks yet.</li>}
        {blocks.map((b) => {
          if (b.kind !== "block") return null;
          const occ = reqByBlock.get(b.id)?.occurrences ?? [];
          return (
            <li key={b.id} className="flex items-start justify-between rounded border border-slate-200 p-2 text-sm">
              <div>
                <span className="font-medium">{b.name}</span>
                <span className="text-slate-500">
                  {" "}· {b.classIds.length} classes · {b.teacherIds.join(", ")} · {b.length} periods
                  {occ.length > 0 ? ` · ${occ.map((o) => o.day).join(", ")}` : ""}
                </span>
              </div>
              <button type="button" onClick={() => apply(removeBlock(project, b.id))} aria-label={`Remove ${b.name}`} className="text-slate-400 hover:text-hard">
                ✕
              </button>
            </li>
          );
        })}
      </ul>
      <h3 className="mb-2 text-sm font-semibold">Add a block</h3>
      <BlockForm
        classOptions={project.classes.map((c) => c.name)}
        teacherOptions={project.teachers.map((t) => t.name)}
        maxPeriods={maxPeriods}
        onAdd={(input) => apply(addBlock(project, input))}
      />
    </PageShell>
  );
}
