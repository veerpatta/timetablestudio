import { useMemo, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { useEditorStore } from "../../store/editorStore";
import { useWeightsStore } from "../../store/weightsStore";
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
    addDraft(`Generated (seed ${c.seed})`, c.placements);
    useEditorStore.setState({ past: [], future: [] });
    onClose();
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-3xl" label="Create timetables">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold">Generate &amp; compare candidates</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </header>

        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-[1fr_240px]">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm">
              <label className="flex items-center gap-1">
                Candidates
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
                {busy ? "Generating…" : "Generate"}
              </button>
              {error && <span className="text-xs text-hard">⚠ {error}</span>}
            </div>

            {scored && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500">
                    <th className="px-2 py-1 text-left">#</th>
                    <th className="px-2 py-1 text-left">Seed</th>
                    <th className="px-2 py-1 text-right">Hard</th>
                    <th className="px-2 py-1 text-right">Score</th>
                    <th className="px-2 py-1 text-left">Soft</th>
                    <th className="px-2 py-1" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scored.map((c, i) => (
                    <tr key={c.seed} className={i === 0 ? "bg-emerald-50" : ""}>
                      <td className="px-2 py-1">{i === 0 ? "★" : i + 1}</td>
                      <td className="px-2 py-1">{c.seed}</td>
                      <td className={`px-2 py-1 text-right ${c.hard ? "text-hard" : "text-emerald-600"}`}>
                        {c.hard}
                      </td>
                      <td className="px-2 py-1 text-right font-mono">{c.score}</td>
                      <td className="px-2 py-1 text-slate-500">
                        {Object.entries(c.softCounts)
                          .sort()
                          .map(([k, v]) => `${k}:${v}`)
                          .join(" ") || "—"}
                      </td>
                      <td className="px-2 py-1 text-right">
                        <button
                          type="button"
                          onClick={() => applyCandidate(c)}
                          className="rounded bg-slate-800 px-2 py-0.5 text-white"
                        >
                          Use
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!scored && !busy && (
              <p className="text-xs text-slate-400">
                Generate several candidates from different seeds, then pick one. Pinned
                placements (ELGA) are preserved in every candidate.
              </p>
            )}
          </div>

          <WeightEditor />
        </div>
    </Modal>
  );
}
