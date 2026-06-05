// Project-state guidance (M14): the single "what should I do next?" signal for
// the header hint, and the pre-flight checklist shown before generation. PURE.
// Reads the SAME demand/classLoads source as the quota matrix and the
// over-capacity blocker, so every "planned vs slots" number agrees.

import { diagnose, classLoads, type Blocker } from "./diagnose";
import type { Id, Project } from "../domain/types";

/** A view the hint/CTA can jump to (matches ui hash routes). */
export type GuidanceView = "timetable" | "quotas";

export interface NextStep {
  message: string;
  cta: string;
  view: GuidanceView;
}

/** The single most important next action, by priority:
 * fix conflicts → add quotas → resolve a structural blocker → plan free
 * periods → ready. Returns null only when there are no classes yet. */
export function nextStep(project: Project, timetableId: Id, hardCount: number): NextStep | null {
  if (project.classes.length === 0) return null;

  if (hardCount > 0) {
    return {
      message: `${hardCount} ${hardCount === 1 ? "clash" : "clashes"} to fix`,
      cta: "Review the grid",
      view: "timetable",
    };
  }

  if (project.requirements.curriculum.length === 0) {
    return { message: "Add weekly subject quotas to get started", cta: "Add quotas", view: "quotas" };
  }

  const report = diagnose(project, timetableId);
  if (!report.ok) {
    const b = report.blockers[0]!;
    return { message: b.message, cta: "Fix this", view: "quotas" };
  }

  const short = classLoads(project, timetableId)
    .filter((c) => c.unplanned > 0)
    .sort((a, b) => b.unplanned - a.unplanned)[0];
  if (short) {
    return {
      message: `${short.name} has ${short.unplanned} unplanned ${short.unplanned === 1 ? "period" : "periods"}`,
      cta: "Plan them",
      view: "quotas",
    };
  }

  return { message: "Looks ready — create your timetable", cta: "Create timetable", view: "timetable" };
}

export interface PreflightItem {
  status: "ok" | "warn" | "blocker";
  label: string;
  detail?: string;
}

export interface Preflight {
  items: PreflightItem[];
  /** Generation may proceed: no blockers (warnings are fine — free periods are valid). */
  ok: boolean;
  blockers: Blocker[];
}

/** A readable checklist run BEFORE the solver: quotas present, each class fits
 * the week, teachers aren't over-committed, blocks fit, and a heads-up for any
 * class left with free periods (a warning, never a blocker). */
export function preflight(project: Project, timetableId: Id): Preflight {
  const items: PreflightItem[] = [];
  const report = diagnose(project, timetableId);

  // 1. Quotas entered at all?
  if (project.requirements.curriculum.length === 0) {
    items.push({
      status: "blocker",
      label: "Weekly subjects added",
      detail: "No subject quotas yet — add them on the Subjects & Quotas grid.",
    });
  } else {
    items.push({ status: "ok", label: "Weekly subjects added" });
  }

  // 2. Teacher + class capacity (structural blockers from diagnose).
  if (report.blockers.length === 0) {
    items.push({ status: "ok", label: "Teachers and classes fit the week" });
  } else {
    for (const b of report.blockers) {
      items.push({ status: "blocker", label: b.message, detail: b.suggestion });
    }
  }

  // 3. Fully-planned classes (under-quota = warning, not a blocker).
  const short = classLoads(project, timetableId).filter((c) => c.unplanned > 0);
  if (short.length === 0) {
    items.push({ status: "ok", label: "Every class's week is fully planned" });
  } else {
    for (const c of short) {
      items.push({
        status: "warn",
        label: `${c.name} has ${c.unplanned} unplanned ${c.unplanned === 1 ? "period" : "periods"}`,
        detail: `${c.planned} of ${c.slots} periods planned — the rest will be left free.`,
      });
    }
  }

  return { items, ok: report.blockers.length === 0 && project.requirements.curriculum.length > 0, blockers: report.blockers };
}
