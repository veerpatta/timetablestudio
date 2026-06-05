import { useEffect, useMemo, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { buildProject, type BuildInput, type TeacherInput } from "../../domain/projectBuilder";
import { addBlock, type BlockInput } from "../../domain/projectEdit";
import type { Day, Project, SchoolClass } from "../../domain/types";
import { Modal } from "../common/Modal";
import { Chips } from "../common/Chips";
import { BlockForm } from "./BlockForm";
import { saveWizardDraft, loadWizardDraft, clearWizardDraft } from "../../persistence/wizardDraft";

const ALL_DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STEPS = ["School", "Classes", "Teachers", "Blocks", "Review"] as const;

function inferGroup(name: string): SchoolClass["group"] {
  const n = Number(name.match(/(\d+)/)?.[1] ?? NaN);
  if (n >= 1 && n <= 5) return "primary";
  if (n >= 11) return "senior";
  return "middle";
}

interface Draft {
  name: string;
  days: Day[];
  periods: number;
  classNames: string[];
  teachers: TeacherInput[];
  blocks: BlockInput[];
}

const EMPTY: Draft = {
  name: "My School",
  days: [...ALL_DAYS],
  periods: 6,
  classNames: [],
  teachers: [],
  blocks: [],
};

export function SetupWizard({ onClose }: { onClose: () => void }) {
  const setProject = useProjectStore((s) => s.setProject);
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(() => loadWizardDraft<Draft>() ?? EMPTY);
  const patch = (p: Partial<Draft>) => setD((prev) => ({ ...prev, ...p }));

  // Autosave wizard progress so a refresh mid-setup doesn't lose input (AC).
  useEffect(() => {
    saveWizardDraft(d);
  }, [d]);

  const teacherNames = d.teachers.map((t) => t.name.trim()).filter(Boolean);

  // Per-step validation messages — shown so the user knows why Next/Finish waits.
  const stepProblems = useMemo<string[]>(() => {
    if (step === 0) {
      const p: string[] = [];
      if (!d.name.trim()) p.push("Enter a school name.");
      if (d.days.length === 0) p.push("Pick at least one teaching day.");
      return p;
    }
    if (step === 1) return d.classNames.length === 0 ? ["Add at least one class."] : [];
    if (step === 2)
      return teacherNames.length === 0 ? ["Add at least one teacher (you can refine subjects later)."] : [];
    return [];
  }, [step, d, teacherNames.length]);
  const stepOk = stepProblems.length === 0;
  const canFinish = d.name.trim() !== "" && d.days.length > 0 && d.classNames.length > 0;

  const finish = () => {
    const input: BuildInput = {
      schoolName: d.name.trim(),
      days: d.days,
      periods: d.periods,
      classes: d.classNames.map((n) => ({ name: n, group: inferGroup(n) })),
      teachers: d.teachers
        .filter((t) => t.name.trim())
        .map((t) => ({ name: t.name.trim(), subjects: t.subjects.filter(Boolean) })),
      quotas: [],
    };
    let project: Project = buildProject(input);
    for (const b of d.blocks) project = addBlock(project, b);
    setProject(project);
    clearWizardDraft();
    // Land on the quota matrix — that's where weekly subjects get filled in bulk.
    window.location.hash = "#/quotas";
    onClose();
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl" label="Set up my school">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold">Set up my school</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
          ✕
        </button>
      </header>

      <ol className="flex gap-1 border-b border-slate-200 px-4 py-2 text-xs">
        {STEPS.map((s, i) => (
          <li key={s} className={`rounded px-2 py-1 ${i === step ? "bg-indigo-600 text-white" : i < step ? "text-emerald-600" : "text-slate-400"}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <div className="space-y-4 p-4 text-sm">
        {step === 0 && (
          <div className="space-y-3">
            <label className="block">
              <span className="text-slate-600">School name</span>
              <input value={d.name} onChange={(e) => patch({ name: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1" />
            </label>
            <div>
              <span className="text-slate-600">Teaching days</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {ALL_DAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => patch({ days: d.days.includes(day) ? d.days.filter((x) => x !== day) : ALL_DAYS.filter((x) => d.days.includes(x) || x === day) })}
                    className={`rounded px-3 py-1 ${d.days.includes(day) ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"}`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="text-slate-600">Periods per day</span>
              <input type="number" min={1} max={12} value={d.periods} onChange={(e) => patch({ periods: Math.max(1, Math.min(12, Number(e.target.value))) })} className="mt-1 block w-20 rounded border border-slate-300 px-2 py-1" />
            </label>
          </div>
        )}

        {step === 1 && (
          <div>
            <span className="text-slate-600">Classes — type a name and press Enter</span>
            <div className="mt-1">
              <Chips
                ariaLabel="Add a class"
                placeholder="e.g. Class 7, Class 11 Science…"
                values={d.classNames}
                onAdd={(n) => patch({ classNames: [...d.classNames, n] })}
                onRemove={(n) => patch({ classNames: d.classNames.filter((x) => x !== n) })}
              />
            </div>
            <span className="mt-1 block text-xs text-slate-400">{d.classNames.length} classes. Group is inferred from the number.</span>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            {d.teachers.map((t, i) => (
              <div key={i} className="rounded border border-slate-200 p-2">
                <div className="mb-1 flex items-center gap-2">
                  <input
                    placeholder="Teacher name"
                    value={t.name}
                    onChange={(e) => patch({ teachers: d.teachers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                    className="w-48 rounded border border-slate-300 px-2 py-1"
                  />
                  <button type="button" onClick={() => patch({ teachers: d.teachers.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-hard" aria-label="Remove teacher">✕</button>
                </div>
                <Chips
                  ariaLabel={`Subjects for teacher ${i + 1}`}
                  placeholder="subjects this teacher can teach…"
                  values={t.subjects}
                  onAdd={(s) => patch({ teachers: d.teachers.map((x, j) => (j === i ? { ...x, subjects: [...x.subjects, s] } : x)) })}
                  onRemove={(s) => patch({ teachers: d.teachers.map((x, j) => (j === i ? { ...x, subjects: x.subjects.filter((y) => y !== s) } : x)) })}
                />
              </div>
            ))}
            <button type="button" onClick={() => patch({ teachers: [...d.teachers, { name: "", subjects: [] }] })} className="rounded border border-slate-300 px-3 py-1 text-xs">+ Add teacher</button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Optional: define blocks like ELGA where several classes regroup together. You can also add these later.
            </p>
            {d.blocks.length > 0 && (
              <ul className="space-y-1 text-xs">
                {d.blocks.map((b, i) => (
                  <li key={i} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1">
                    <span>{b.name} · {b.classIds.length} classes · {b.teacherIds.join(", ")} · {b.length}p · {b.days.join(", ")}</span>
                    <button type="button" onClick={() => patch({ blocks: d.blocks.filter((_, j) => j !== i) })} aria-label={`Remove ${b.name}`} className="text-slate-400 hover:text-hard">✕</button>
                  </li>
                ))}
              </ul>
            )}
            <BlockForm
              classOptions={d.classNames}
              teacherOptions={teacherNames}
              maxPeriods={d.periods}
              onAdd={(b) => patch({ blocks: [...d.blocks, b] })}
            />
          </div>
        )}

        {step === 4 && (
          <ul className="space-y-1 text-slate-700">
            <li><strong>{d.name}</strong> · {d.days.length} days · {d.periods} periods/day</li>
            <li>{d.classNames.length} classes · {teacherNames.length} teachers · {d.blocks.length} blocks</li>
            <li className="text-xs text-slate-400">Next you'll set weekly subjects on the Subjects &amp; Quotas grid (with copy/fill bulk tools).</li>
          </ul>
        )}

        {stepProblems.length > 0 && (
          <ul className="list-inside list-disc text-xs text-hard">
            {stepProblems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-40">Back</button>
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={() => setStep((s) => s + 1)} disabled={!stepOk} className="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-40">Next</button>
        ) : (
          <button type="button" onClick={finish} disabled={!canFinish} className="rounded bg-emerald-600 px-4 py-1 text-sm font-medium text-white disabled:opacity-40">Create school</button>
        )}
      </footer>
    </Modal>
  );
}
