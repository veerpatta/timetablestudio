// Smart-validation panel (RB3). Lists the real, plain-language problems (joint/team
// overlaps are never flagged — see domain/issues). Each row jumps to the offending cell
// and, where a safe legal fix exists, offers a one-click "Fix it" that previews the
// change in its label and is fully undoable. Hidden entirely when there are no problems
// (the header badge already says "No clashes").

import { suggestFixes } from "../../domain/fixes";
import { buildIssues } from "../../domain/issues";
import { validate } from "../../domain/validate";
import type { Day, Id, Project, Timetable } from "../../domain/types";

interface Props {
  project: Project;
  timetable: Timetable;
  onJump: (classId: Id, day: Day, slot: number) => void;
  onFix: (next: Project) => void;
}

export function IssuesPanel({ project, timetable, onJump, onFix }: Props): React.ReactElement | null {
  const issues = buildIssues(project, timetable);
  const soft = validate(project, timetable).filter((v) => v.severity === "soft");
  if (issues.length === 0 && soft.length === 0) return null;

  return (
    <>
      {issues.length > 0 && (
    <section className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
      <h2 className="mb-2 text-sm font-semibold text-rose-800">
        Rule broken · {issues.length}
      </h2>
      <ul className="space-y-2">
        {issues.map((issue) => {
          const fix = issue.fixable ? suggestFixes(project, timetable, issue.violation)[0] : undefined;
          return (
            <li key={issue.id} className="rounded border border-rose-100 bg-white p-2">
              <p className="text-sm text-slate-700">{issue.title}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {issue.jump && (
                  <button
                    onClick={() => onJump(issue.jump!.classId, issue.jump!.day, issue.jump!.slot)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Show me
                  </button>
                )}
                {fix ? (
                  <button
                    onClick={() => onFix(fix.project)}
                    className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    Fix it · {fix.label}
                  </button>
                ) : (
                  <span className="px-1 py-1 text-xs text-slate-400">No automatic fix — adjust it by hand.</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
      )}

      {soft.length > 0 && (
        <section className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <h2 className="mb-2 text-sm font-semibold text-amber-800">Could be better · {soft.length}</h2>
          <ul className="max-h-48 space-y-1 overflow-auto text-sm text-slate-700">
            {soft.map((v, i) => (
              <li key={`${v.constraintId}#${i}`} className="rounded bg-white px-2 py-1">{v.message}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
