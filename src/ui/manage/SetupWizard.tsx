import { useMemo, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { buildProject, type BuildInput, type QuotaInput, type TeacherInput } from "../../domain/projectBuilder";
import type { Day, SchoolClass } from "../../domain/types";

const ALL_DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function inferGroup(name: string): SchoolClass["group"] {
  const n = Number(name.match(/(\d+)/)?.[1] ?? NaN);
  if (n >= 1 && n <= 5) return "primary";
  if (n >= 11) return "senior";
  return "middle";
}

const STEPS = ["School", "Classes", "Teachers", "Quotas", "Review"] as const;

export function SetupWizard({ onClose }: { onClose: () => void }) {
  const setProject = useProjectStore((s) => s.setProject);
  const [step, setStep] = useState(0);

  const [name, setName] = useState("My School");
  const [days, setDays] = useState<Day[]>([...ALL_DAYS]);
  const [periods, setPeriods] = useState(6);
  const [classText, setClassText] = useState("Class 1\nClass 2\nClass 3\nClass 4\nClass 5");
  const [teachers, setTeachers] = useState<TeacherInput[]>([{ name: "", subjects: [] }]);
  const [quotas, setQuotas] = useState<QuotaInput[]>([]);

  const classNames = useMemo(
    () => classText.split("\n").map((l) => l.trim()).filter(Boolean),
    [classText],
  );
  const teacherNames = teachers.map((t) => t.name.trim()).filter(Boolean);
  const subjectNames = useMemo(() => {
    const set = new Set<string>();
    for (const t of teachers) t.subjects.forEach((s) => s && set.add(s));
    for (const q of quotas) if (q.subject) set.add(q.subject);
    return [...set];
  }, [teachers, quotas]);

  const canFinish = name.trim() !== "" && days.length > 0 && classNames.length > 0;

  const finish = () => {
    const input: BuildInput = {
      schoolName: name.trim(),
      days,
      periods,
      classes: classNames.map((n) => ({ name: n, group: inferGroup(n) })),
      teachers: teachers
        .filter((t) => t.name.trim())
        .map((t) => ({ name: t.name.trim(), subjects: t.subjects.filter(Boolean) })),
      quotas: quotas.filter((q) => q.className && q.subject && q.teacher && q.periodsPerWeek > 0),
    };
    setProject(buildProject(input));
    onClose();
  };

  return (
    <div className="modal-overlay fixed inset-0 z-20 flex items-start justify-center overflow-auto bg-black/40 p-4 sm:p-6">
      <div className="modal-card w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold">Set up my school</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </header>

        <ol className="flex gap-1 border-b border-slate-200 px-4 py-2 text-xs">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={`rounded px-2 py-1 ${i === step ? "bg-indigo-600 text-white" : i < step ? "text-emerald-600" : "text-slate-400"}`}
            >
              {i + 1}. {s}
            </li>
          ))}
        </ol>

        <div className="space-y-4 p-4 text-sm">
          {step === 0 && (
            <div className="space-y-3">
              <label className="block">
                <span className="text-slate-600">School name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1" />
              </label>
              <div>
                <span className="text-slate-600">Teaching days</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {ALL_DAYS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...ALL_DAYS].filter((x) => p.includes(x) || x === d)))}
                      className={`rounded px-3 py-1 ${days.includes(d) ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="text-slate-600">Periods per day</span>
                <input type="number" min={1} max={12} value={periods} onChange={(e) => setPeriods(Math.max(1, Math.min(12, Number(e.target.value))))} className="mt-1 w-20 rounded border border-slate-300 px-2 py-1" />
              </label>
            </div>
          )}

          {step === 1 && (
            <label className="block">
              <span className="text-slate-600">Classes — one per line</span>
              <textarea value={classText} onChange={(e) => setClassText(e.target.value)} className="mt-1 h-48 w-full rounded border border-slate-300 p-2 font-mono text-xs" />
              <span className="mt-1 block text-xs text-slate-400">{classNames.length} classes. Group (primary/middle/senior) is inferred from the number.</span>
            </label>
          )}

          {step === 2 && (
            <div className="space-y-2">
              {teachers.map((t, i) => (
                <div key={i} className="flex gap-2">
                  <input placeholder="Teacher name" value={t.name} onChange={(e) => setTeachers((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="w-40 rounded border border-slate-300 px-2 py-1" />
                  <input placeholder="Subjects (comma separated)" value={t.subjects.join(", ")} onChange={(e) => setTeachers((p) => p.map((x, j) => (j === i ? { ...x, subjects: e.target.value.split(",").map((s) => s.trim()) } : x)))} className="flex-1 rounded border border-slate-300 px-2 py-1" />
                  <button type="button" onClick={() => setTeachers((p) => p.filter((_, j) => j !== i))} className="rounded px-2 text-slate-400 hover:text-hard" aria-label="Remove teacher">✕</button>
                </div>
              ))}
              <button type="button" onClick={() => setTeachers((p) => [...p, { name: "", subjects: [] }])} className="rounded border border-slate-300 px-3 py-1 text-xs">+ Add teacher</button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-2">
              {quotas.map((q, i) => (
                <div key={i} className="flex flex-wrap gap-2">
                  <select value={q.className} onChange={(e) => setQuotas((p) => p.map((x, j) => (j === i ? { ...x, className: e.target.value } : x)))} className="rounded border border-slate-300 px-2 py-1">
                    <option value="">Class…</option>
                    {classNames.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input list="subjects" placeholder="Subject" value={q.subject} onChange={(e) => setQuotas((p) => p.map((x, j) => (j === i ? { ...x, subject: e.target.value } : x)))} className="w-32 rounded border border-slate-300 px-2 py-1" />
                  <select value={q.teacher} onChange={(e) => setQuotas((p) => p.map((x, j) => (j === i ? { ...x, teacher: e.target.value } : x)))} className="rounded border border-slate-300 px-2 py-1">
                    <option value="">Teacher…</option>
                    {teacherNames.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input type="number" min={1} max={20} value={q.periodsPerWeek} onChange={(e) => setQuotas((p) => p.map((x, j) => (j === i ? { ...x, periodsPerWeek: Number(e.target.value) } : x)))} className="w-16 rounded border border-slate-300 px-2 py-1" title="Periods per week" />
                  <button type="button" onClick={() => setQuotas((p) => p.filter((_, j) => j !== i))} className="rounded px-2 text-slate-400 hover:text-hard" aria-label="Remove quota">✕</button>
                </div>
              ))}
              <datalist id="subjects">{subjectNames.map((s) => <option key={s} value={s} />)}</datalist>
              <button type="button" onClick={() => setQuotas((p) => [...p, { className: "", subject: "", teacher: "", periodsPerWeek: 5 }])} className="rounded border border-slate-300 px-3 py-1 text-xs">+ Add quota</button>
            </div>
          )}

          {step === 4 && (
            <ul className="space-y-1 text-slate-700">
              <li><strong>{name}</strong> · {days.length} days · {periods} periods/day</li>
              <li>{classNames.length} classes · {teacherNames.length} teachers · {quotas.length} subject quotas</li>
              <li className="text-xs text-slate-400">You can add an ELGA-style block and fine-tune everything from the data manager afterwards.</li>
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-40">Back</button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={() => setStep((s) => s + 1)} className="rounded bg-indigo-600 px-3 py-1 text-sm text-white">Next</button>
          ) : (
            <button type="button" onClick={finish} disabled={!canFinish} className="rounded bg-emerald-600 px-4 py-1 text-sm font-medium text-white disabled:opacity-40">Create timetable</button>
          )}
        </footer>
      </div>
    </div>
  );
}
