import { useState } from "react";
import type { BlockInput } from "../../domain/projectEdit";
import type { Day } from "../../domain/types";

const ALL_DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Define a multi-class block (e.g. ELGA). Shared by the Blocks page and the
 * wizard's Blocks step. Inline validation explains why "Add" is disabled. */
export function BlockForm({
  classOptions,
  teacherOptions,
  maxPeriods,
  onAdd,
}: {
  classOptions: string[];
  teacherOptions: string[];
  maxPeriods: number;
  onAdd: (input: BlockInput) => void;
}) {
  const [name, setName] = useState("ELGA");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [teacherIds, setTeacherIds] = useState<string[]>([]);
  const [length, setLength] = useState(3);
  const [startPeriod, setStartPeriod] = useState(3);
  const [days, setDays] = useState<Day[]>([]);

  const problems: string[] = [];
  if (!name.trim()) problems.push("Give the block a name (e.g. ELGA).");
  if (classIds.length < 1) problems.push("Pick at least one class.");
  if (teacherIds.length < 1) problems.push("Pick at least one teacher.");
  if (days.length < 1) problems.push("Pick at least one day it runs.");
  if (startPeriod + length - 1 > maxPeriods)
    problems.push(`It runs past the last period (P${maxPeriods}). Lower the length or start.`);
  const valid = problems.length === 0;

  const toggle = <T,>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const pill = (active: boolean) =>
    `rounded px-2 py-0.5 text-xs ${active ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"}`;

  return (
    <div className="space-y-3 rounded border border-slate-200 p-3 text-sm">
      <label className="block">
        <span className="text-slate-600">Block name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-48 rounded border border-slate-300 px-2 py-1"
        />
      </label>

      <div>
        <span className="text-slate-600">Classes that regroup together</span>
        <div className="mt-1 flex flex-wrap gap-1">
          {classOptions.map((c) => (
            <button key={c} type="button" onClick={() => setClassIds((p) => toggle(p, c))} className={pill(classIds.includes(c))}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-slate-600">Teachers occupied during the block</span>
        <div className="mt-1 flex flex-wrap gap-1">
          {teacherOptions.map((t) => (
            <button key={t} type="button" onClick={() => setTeacherIds((p) => toggle(p, t))} className={pill(teacherIds.includes(t))}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="block">
          <span className="text-slate-600">Length (periods)</span>
          <input type="number" min={1} max={maxPeriods} value={length} onChange={(e) => setLength(Math.max(1, Number(e.target.value)))} className="mt-1 w-20 rounded border border-slate-300 px-2 py-1" />
        </label>
        <label className="block">
          <span className="text-slate-600">Starts at period</span>
          <input type="number" min={1} max={maxPeriods} value={startPeriod} onChange={(e) => setStartPeriod(Math.max(1, Number(e.target.value)))} className="mt-1 w-20 rounded border border-slate-300 px-2 py-1" />
        </label>
      </div>

      <div>
        <span className="text-slate-600">Days it runs</span>
        <div className="mt-1 flex flex-wrap gap-1">
          {ALL_DAYS.map((d) => (
            <button key={d} type="button" onClick={() => setDays((p) => toggle(p, d))} className={pill(days.includes(d))}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {!valid && (
        <ul className="list-inside list-disc text-xs text-hard">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={!valid}
        onClick={() => {
          onAdd({ name: name.trim(), classIds, teacherIds, length, days, startPeriod });
          setClassIds([]);
          setTeacherIds([]);
          setDays([]);
        }}
        className="rounded bg-indigo-600 px-3 py-1 text-white disabled:opacity-40"
      >
        Add block
      </button>
    </div>
  );
}
