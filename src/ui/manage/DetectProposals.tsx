import { useMemo, useState } from "react";
import { Modal } from "../common/Modal";
import { detectRules, acceptProposal, type RuleProposal } from "../../domain/ruleDetect";
import type { Project, Timetable } from "../../domain/types";

interface Props {
  project: Project;
  timetable: Timetable;
  apply: (p: Project) => void;
  onClose: () => void;
}

/** Review screen for auto-detected rules: each detected pattern as a sentence to
 * accept one-by-one or all at once (the owner confirms reality, M16). */
export function DetectProposals({ project, timetable, apply, onClose }: Props) {
  const proposals = useMemo(() => detectRules(project, timetable), [project, timetable]);
  const existing = new Set(project.rules.map((r) => r.id));
  const [done, setDone] = useState<Set<string>>(new Set());

  const accept = (p: RuleProposal) => {
    apply(acceptProposal(project, p));
    setDone((d) => new Set(d).add(p.id));
  };
  const acceptAll = () => {
    let next = project;
    for (const p of proposals) if (!done.has(p.id) && !existing.has(p.id)) next = acceptProposal(next, p);
    apply(next);
    setDone(new Set(proposals.map((p) => p.id)));
  };

  return (
    <Modal onClose={onClose} label="Detected rules" maxWidth="max-w-xl">
      <div className="p-5">
        <h2 className="text-lg font-semibold">Rules found in your timetable</h2>
        <p className="mt-1 text-sm text-slate-500">
          We spotted these patterns already in use. Accept the ones that match how your school runs.
        </p>
        {proposals.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No clear patterns detected yet.</p>
        ) : (
          <>
            <ul className="mt-4 max-h-80 space-y-2 overflow-auto">
              {proposals.map((p) => {
                const accepted = done.has(p.id) || existing.has(p.id);
                return (
                  <li key={p.id} className="flex items-start justify-between gap-3 rounded border border-slate-200 p-2 text-sm">
                    <span className="text-slate-700">“{p.sentence}”</span>
                    <button
                      type="button"
                      onClick={() => accept(p)}
                      disabled={accepted}
                      className="shrink-0 rounded border border-indigo-300 px-2 py-0.5 text-xs text-indigo-700 hover:bg-indigo-50 disabled:opacity-40"
                    >
                      {accepted ? "Added ✓" : "Accept"}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50">
                Done
              </button>
              <button type="button" onClick={acceptAll} className="rounded bg-indigo-600 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-700">
                Accept all
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
