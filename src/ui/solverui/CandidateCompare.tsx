import { useMemo, useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { useEditorStore } from "../../store/editorStore";
import { useWeightsStore } from "../../store/weightsStore";
import { useUiStore } from "../../store/uiStore";
import { scoreTimetable } from "../../solver/score";
import { diagnose, type Blocker } from "../../solver/diagnose";
import { diffTimetables } from "../../domain/diff";
import { runSolver } from "./runSolver";
import { WeightEditor } from "./WeightEditor";
import { BlockerReport } from "./BlockerReport";
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
  const [blockers, setBlockers] = useState<Blocker[] | null>(null);
  const [diffSeed, setDiffSeed] = useState<number | null>(null);

  const currentPlacements = useMemo(
    () => (project ? active(project).placements : []),
    [project],
  );

  const scored = useMemo(() => {
    if (!project || !candidates) return null;
    return candidates
      .map((c) => {
        const proj = withPlacements(project, c.placements);
        const b = scoreTimetable(proj, active(proj), weights);
        const changes = diffTimetables(project, currentPlacements, c.placements).length;
        return { ...c, score: b.score, hard: b.hard, changes };
      })
      .sort((a, b) => a.score - b.score);
  }, [project, candidates, weights, currentPlacements]);

  const diffChanges = useMemo(() => {
    if (!project || diffSeed === null || !candidates) return null;
    const c = candidates.find((x) => x.seed === diffSeed);
    if (!c) return null;
    return diffTimetables(project, currentPlacements, c.placements);
  }, [project, diffSeed, candidates, currentPlacements]);

  if (!project) return null;

  const generate = async () => {
    setError(null);
    setDiffSeed(null);
    const pre = diagnose(project, project.activeTimetableId!);
    if (!pre.ok) {
      setBlockers(pre.blockers);
      return;
    }
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
                    <th className="px-2 py-1 text-right">Changes</th>
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
                      <td className="px-2 py-1 text-right">
                        <button
                          type="button"
                          onClick={() => setDiffSeed(diffSeed === c.seed ? null : c.seed)}
                          className="text-sky-600 hover:underline"
                        >
                          {c.changes} {diffSeed === c.seed ? "▾" : ""}
                        </button>
                      </td>
                      {advanced && <td className="px-2 py-1 text-right font-mono">{c.seed}</td>}
                      {advanced && <td className="px-2 py-1 text-right font-mono">{c.score}</td>}
                      <td className="px-2 py-1 text-right">
                        <button
                          type="button"
                          onClick={() => applyCandidate(c)}
                          disabled={c.hard > 0}
                          title={c.hard > 0 ? "This option still has conflicts" : "Use this option"}
                          className="rounded bg-slate-800 px-2 py-0.5 text-white disabled:opacity-40"
                        >
                          Use this
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {diffChanges && (
              <div className="mt-3 rounded border border-slate-200 p-2">
                <p className="mb-1 text-xs font-semibold">
                  Changes vs the current timetable ({diffChanges.length})
                </p>
                {diffChanges.length === 0 ? (
                  <p className="text-xs text-slate-400">Identical to the current timetable.</p>
                ) : (
                  <ul className="max-h-40 space-y-0.5 overflow-auto text-xs">
                    {diffChanges.slice(0, 60).map((ch, j) => (
                      <li key={j} className="text-slate-600">
                        <span className="font-medium">{ch.className}</span> {ch.day} P{ch.period}:{" "}
                        <span className="text-slate-400">{ch.before || "—"}</span> →{" "}
                        <span className="text-slate-700">{ch.after || "—"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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
        {blockers && <BlockerReport blockers={blockers} onClose={() => setBlockers(null)} />}
    </Modal>
  );
}
