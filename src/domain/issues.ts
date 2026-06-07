// Smart validation surface (PURE) — RB3. Turns validate()'s hard Violations into a
// plain-language Issue list with a click-to-jump target. There is NO separate "is this
// a real clash?" logic here: validate() already implements the event clash rule, so a
// joint_class / team_block overlap is never a violation — the bundled timetable yields
// ZERO issues by construction (asserted in issues.test.ts).
//
// The Issues panel is the safety net for clashes that arrive from OUTSIDE the legal-only
// editor — teacher absence/reassignment, availability edits, or project import. The
// editor itself can't create one.

import { findProfile, placementSlots } from "./derive";
import { validate } from "./validate";
import type { Day, Id, Placement, Project, Timetable, Violation } from "./types";

export interface JumpTarget {
  classId: Id;
  day: Day;
  slot: number;
}

export interface Issue {
  id: string;
  title: string; // plain-language (validate() messages already name entities, no codes)
  jump: JumpTarget | null; // where to take the owner in the class view
  fixable: boolean; // whether a safe, legal fix exists (see fixes.ts)
  violation: Violation;
}

/**
 * The movable placement a violation implicates — not pinned, and a single-class normal
 * lesson (a shared joint/team event is never silently re-pointed). Returns it with the
 * class to jump to, or null when nothing at that slot is safely actionable (e.g. the
 * clash is between two pinned/shared events — then the AC's "fix where one exists" yields
 * no fix). One helper feeds BOTH jump and fix so they can never disagree.
 */
export function actionablePlacement(
  project: Project,
  timetable: Timetable,
  v: Violation,
): { placement: Placement; classId: Id; day: Day; slot: number } | null {
  const profile = findProfile(project, timetable);
  const loc = v.slots[0];
  if (!profile || !loc) return null;
  const { day, slot } = loc;
  const eventIndex = new Map(project.events.map((e) => [e.id, e]));

  const candidates = timetable.placements.filter((p) => {
    if (p.day !== day) return false;
    const ev = eventIndex.get(p.eventId);
    if (!ev) return false;
    if (!placementSlots(profile, p, ev)?.includes(slot)) return false;
    if (loc.eventId && p.eventId !== loc.eventId) return false;
    if (loc.teacherId && !ev.teacherIds.includes(loc.teacherId)) return false;
    if (loc.classId && !ev.classIds.includes(loc.classId)) return false;
    return true;
  });

  const movable = candidates.find((p) => {
    const ev = eventIndex.get(p.eventId)!;
    return !p.pinned && ev.classIds.length === 1;
  });
  if (!movable) return null;
  const ev = eventIndex.get(movable.eventId)!;
  return { placement: movable, classId: ev.classIds[0]!, day, slot };
}

/** Best-effort jump target even when no fix is possible: the actionable class, else the
 *  violation's own classId, else a class sharing the offending teacher's slot. */
function jumpTarget(project: Project, timetable: Timetable, v: Violation): JumpTarget | null {
  const act = actionablePlacement(project, timetable, v);
  if (act) return { classId: act.classId, day: act.day, slot: act.slot };
  const loc = v.slots[0];
  if (!loc) return null;
  if (loc.classId) return { classId: loc.classId, day: loc.day, slot: loc.slot };
  const eventIndex = new Map(project.events.map((e) => [e.id, e]));
  if (loc.teacherId) {
    for (const p of timetable.placements) {
      const ev = eventIndex.get(p.eventId);
      if (p.day === loc.day && ev?.teacherIds.includes(loc.teacherId) && ev.classIds[0]) {
        return { classId: ev.classIds[0], day: loc.day, slot: loc.slot };
      }
    }
  }
  return null;
}

/** All current hard problems as plain-language issues. Empty on a clash-free timetable. */
export function buildIssues(project: Project, timetable: Timetable): Issue[] {
  const hard = validate(project, timetable).filter((v) => v.severity === "hard");
  return hard.map((v, i) => {
    const act = actionablePlacement(project, timetable, v);
    return {
      id: `${v.constraintId}#${i}`,
      title: v.message,
      jump: jumpTarget(project, timetable, v),
      fixable: act !== null,
      violation: v,
    };
  });
}
