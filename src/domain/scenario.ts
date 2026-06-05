// Scenario workbench core (M17). PURE — no DOM/store/worker. The speculative
// primitives behind "try a change safely": change ledger, move-impact preview,
// swap finder, and scoped clearing for targeted regenerate. Everything reuses
// the shared `validate()` oracle so the editor and these tools never disagree.

import { validate } from "./validate";
import { diffTimetables, type CellChange } from "./diff";
import { movePlacement, type PlacementRef } from "./edit";
import type { Day, Id, Lesson, Placement, Project, Timetable, Violation } from "./types";

// --- the one speculative primitive everything shares ---
const violationKey = (v: Violation): string =>
  `${v.constraintId}|${v.slots
    .map((s) => `${s.classId ?? ""}:${s.teacherId ?? ""}:${s.day}:${s.period}`)
    .join(",")}`;

/** Set of hard-violation keys for a placements set (under `project`). */
export function hardKeySet(project: Project, timetable: Timetable, placements: Placement[]): Set<string> {
  const tt: Timetable = { ...timetable, placements };
  return new Set(validate(project, tt).filter((v) => v.severity === "hard").map(violationKey));
}

function withPlacements(timetable: Timetable, placements: Placement[]): Timetable {
  return { ...timetable, placements };
}

// --- change ledger: cells changed + problems fixed/created ---
export interface ChangeLedger {
  changes: CellChange[];
  fixed: number; // hard violations in baseline but gone in the scenario
  created: number; // hard violations new in the scenario
}

export function changeLedger(
  project: Project,
  baseline: Timetable,
  scenario: Timetable,
): ChangeLedger {
  const before = hardKeySet(project, baseline, baseline.placements);
  const after = hardKeySet(project, scenario, scenario.placements);
  let fixed = 0;
  let created = 0;
  for (const k of before) if (!after.has(k)) fixed++;
  for (const k of after) if (!before.has(k)) created++;
  return { changes: diffTimetables(project, baseline.placements, scenario.placements), fixed, created };
}

// --- impact preview for a speculative move ---
export interface MoveImpact {
  fixes: Violation[]; // hard violations the move would remove
  breaks: Violation[]; // hard violations the move would introduce
}

export function impactOfMove(
  project: Project,
  timetable: Timetable,
  ref: PlacementRef,
  toDay: Day,
  toPeriod: number,
): MoveImpact {
  const before = validate(project, timetable).filter((v) => v.severity === "hard");
  const moved = withPlacements(timetable, movePlacement(timetable.placements, ref, toDay, toPeriod));
  const after = validate(project, moved).filter((v) => v.severity === "hard");
  const beforeKeys = new Set(before.map(violationKey));
  const afterKeys = new Set(after.map(violationKey));
  return {
    fixes: before.filter((v) => !afterKeys.has(violationKey(v))),
    breaks: after.filter((v) => !beforeKeys.has(violationKey(v))),
  };
}

// --- swap finder ---
export interface Swap {
  ref: PlacementRef;
  with: PlacementRef;
}

const refOf = (p: Placement): PlacementRef => ({ activityId: p.activityId, day: p.day, period: p.period });
const sameRef = (a: PlacementRef, b: PlacementRef): boolean =>
  a.activityId === b.activityId && a.day === b.day && a.period === b.period;

/** Exchange the (day, period) of two placements. PURE. */
export function applySwap(placements: Placement[], a: PlacementRef, b: PlacementRef): Placement[] {
  return placements.map((p) => {
    if (sameRef(refOf(p), a)) return { ...p, day: b.day, period: b.period };
    if (sameRef(refOf(p), b)) return { ...p, day: a.day, period: a.period };
    return p;
  });
}

// A single-period, single-class lesson is the only swappable unit (blocks and
// double periods move as larger units — out of scope for a simple exchange).
function swappableLesson(project: Project, placement: Placement): Lesson | null {
  const a = project.activities.find((x) => x.id === placement.activityId);
  if (!a || a.kind !== "lesson" || (a.duration ?? 1) !== 1) return null;
  return a;
}

const sharesClassOrTeacher = (a: Lesson, b: Lesson): boolean =>
  a.classId === b.classId || a.teacherIds.some((t) => b.teacherIds.includes(t));

/** Legal conflict-free swaps for the selected placement: exchanges with another
 * single lesson that shares its class or a teacher and leave 0 hard violations. */
export function legalSwaps(project: Project, timetable: Timetable, ref: PlacementRef): Swap[] {
  const selected = timetable.placements.find((p) => sameRef(refOf(p), ref));
  if (!selected) return [];
  const selLesson = swappableLesson(project, selected);
  if (!selLesson) return [];
  const out: Swap[] = [];
  for (const q of timetable.placements) {
    const qRef = refOf(q);
    if (sameRef(qRef, ref)) continue;
    if (q.day === selected.day && q.period === selected.period) continue; // same slot
    const qLesson = swappableLesson(project, q);
    if (!qLesson || !sharesClassOrTeacher(selLesson, qLesson)) continue;
    const swapped = withPlacements(timetable, applySwap(timetable.placements, ref, qRef));
    if (validate(project, swapped).some((v) => v.severity === "hard")) continue;
    out.push({ ref, with: qRef });
  }
  return out;
}

// --- targeted regenerate: clear a scope, then complete-solve refills only it ---
export type RegenScope =
  | { kind: "class"; id: Id }
  | { kind: "teacher"; id: Id }
  | { kind: "subject"; id: Id };

function lessonInScope(lesson: Lesson, scope: RegenScope): boolean {
  switch (scope.kind) {
    case "class":
      return lesson.classId === scope.id;
    case "teacher":
      return lesson.teacherIds.includes(scope.id);
    case "subject":
      return lesson.subjectId === scope.id;
  }
}

/** Whether a placement is a non-pinned single-class lesson inside the scope
 * (blocks and pinned placements stay FROZEN — clearing a primary class must not
 * unfreeze ELGA). */
export function placementInScope(project: Project, placement: Placement, scope: RegenScope): boolean {
  if (placement.pinned) return false;
  const a = project.activities.find((x) => x.id === placement.activityId);
  if (!a || a.kind !== "lesson") return false;
  return lessonInScope(a, scope);
}

/** Return the project with the timetable's IN-SCOPE non-pinned lessons removed.
 * A subsequent complete-solve refills exactly those (shortfall == cleared
 * lessons, assuming the baseline meets quota), so only the scope changes. */
export function withClearedScope(project: Project, timetableId: Id, scope: RegenScope): Project {
  return {
    ...project,
    timetables: project.timetables.map((t) =>
      t.id === timetableId
        ? { ...t, placements: t.placements.filter((p) => !placementInScope(project, p, scope)) }
        : t,
    ),
  };
}

/** Cells that differ between two placement sets, for asserting scope containment. */
export function changedCells(project: Project, before: Placement[], after: Placement[]): CellChange[] {
  return diffTimetables(project, before, after);
}
