import { useMemo, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { useEditorStore } from "../../store/editorStore";
import { useWeightsStore } from "../../store/weightsStore";
import { useUiStore } from "../../store/uiStore";
import { scoreTimetable } from "../../solver/score";
import { runSolver } from "./runSolver";
import { WeightEditor } from "./WeightEditor";
import { Modal } from "../common/Modal";
import type { Placement, Project, Timetable } from "../../domain/types";

interface Candidate {
  seed: number;
  placements: Placement[];
  feasible: boolean;
}

const active = (p: Project): Timetable =>
  p.timetables.find((t) => t.id === p.activeTimetableId)!;
const withPlacements = (p: Project, placements: Placement[]): Project => ({
  ...p,
  timetables: p.timetables.map((t) => (t.id === p.activeTimetableId ? { ...t, placements } : t)),
});

export function CandidateCompare({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const addDraft = useProjectStore((s) => s.addDraft);
  const weights = useWeightsStore((s) => s.weights);
  const advanced = useUiStore((s) => s.advanced);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [n, setN] = useState(3);
  const [seedBase, setSeedBase] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const scored = useMemo(() => {
    if (!project || !candidates) return null;
    return candidates
      .map((c) => {
        const proj = withPlacements(project, c.placements);
        const b = scoreTimetable(proj, active(proj), weights);
        const softCounts: Record<string, number> = {};
        for (const v of b.soft) softCounts[v.constraintId] = (softCounts[v.constraintId] ?? 0) + 1;
        return { ...c, score: b.score, hard: b.hard, softCounts };
      })
      .sort((a, b) => a.score - b.score);
  }, [project, candidates, weights]);

  if (!project) return null;

  const generate = async () => {
    setError(null);
    setBusy(true);
    setCandidates(null);
    const out: Candidate[] = [];
    try {
      for (let i = 0; i < n; i++) {
        const seed = seedBase + i;
        const { promise } = runSolver({
          project,
          timetableId: project.activeTimetableId!,
          mode: "generate",
          seed,
          maxMillis: 5000,
        });
        const done = await promise;
        out.push({ seed, placements: done.placements, feasible: done.feasible });
        setCandidates([...out]);
      }
      setSeedBase((s) => s + n);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const applyCandidate = (c: Candidate) => {
    const rank = (scored ?? []).findIndex((x) => x.seed === c.seed);
    addDraft(rank === 0 ? "Created timetable (best fit)" : "Created timetable", c.placements);
    useEditorStore.setState({ past: [], future: [] });
    onClose();
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-3xl" label="Create timetables">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold">Create &amp; compare timetables</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </header>

        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-[1fr_240px]">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm">
              <label className="flex items-center gap-1">
                How many options
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={n}
                  onChange={(e) => setN(Math.max(1, Math.min(8, Number(e.target.value))))}
                  className="w-14 rounded border border-slate-300 px-1 py-0.5"
                />
              </label>
              <button
                type="button"
                onClick={generate}
                disabled={busy}
                className="rounded bg-indigo-600 px-3 py-1 font-medium text-white disabled:opacity-50"
              >
                {busy ? "Working…" : "Create options"}
              </button>
              {error && <span className="text-xs text-hard">⚠ {error}</span>}
            </div>

            {scored && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500">
                    <th className="px-2 py-1 text-left">Option</th>
                    <th className="px-2 py-1 text-right">Conflicts</th>
                    <th className="px-2 py-1 text-left">Quality</th>
                    {advanced && <th className="px-2 py-1 text-right">seed</th>}
                    {advanced && <th className="px-2 py-1 text-right">score</th>}
                    <th className="px-2 py-1" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scored.map((c, i) => (
                    <tr key={c.seed} className={i === 0 ? "bg-emerald-50" : ""}>
                      <td className="px-2 py-1">{i === 0 ? "★ Best" : `Option ${i + 1}`}</td>
                      <td className={`px-2 py-1 text-right ${c.hard ? "text-hard" : "text-emerald-600"}`}>
                        {c.hard === 0 ? "None" : c.hard}
                      </td>
                      <td className="px-2 py-1 text-slate-500">
                        {i === 0 ? "Best fit" : "Good"}
                      </td>
                      {advanced && <td className="px-2 py-1 text-right font-mono">{c.seed}</td>}
                      {advanced && <td className="px-2 py-1 text-right font-mono">{c.score}</td>}
                      <td className="px-2 py-1 text-right">
                        <button
                          type="button"
                          onClick={() => applyCandidate(c)}
                          className="rounded bg-slate-800 px-2 py-0.5 text-white"
                        >
                          Use this
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!scored && !busy && (
              <p className="text-xs text-slate-400">
                Create a few options, then pick the one you like. Anything you've pinned (like
                ELGA) is kept in every option.
              </p>
            )}
          </div>

          <WeightEditor />
        </div>
    </Modal>
  );
}
