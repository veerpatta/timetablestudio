// One-click safe fixes (PURE) — RB3. A fix is a reviewable, legal, UNDOABLE change: it
// reuses the same primitives the editor uses (legalOptions / canMove / clearCell), so a
// "Fix it" can never introduce a clash. Every candidate must STRICTLY reduce the hard
// count (afterHard < beforeHard) — a move that merely trades one clash for another is
// rejected. Ordered least-destructive first: reassign teacher → move lesson → clear.
//
// This is orchestration, not new constraint logic: validate() stays the single oracle.

import { findProfile } from "./derive";
import { clearCell, placeNormalLesson } from "./edit";
import { actionablePlacement } from "./issues";
import { legalOptions } from "./legalMoves";
import { slotLabel, teachingSlots } from "./profile";
import { canMove } from "./swaps";
import { validate } from "./validate";
import type { Project, Timetable, Violation } from "./types";

export interface Fix {
  label: string; // plain-language ("Reassign to Maths — Nidhika")
  project: Project; // the timetable AFTER the fix (fewer hard violations, still legal)
}

function hardOf(project: Project, timetableId: string): number {
  const tt = project.timetables.find((t) => t.id === timetableId);
  return tt ? validate(project, tt).filter((v) => v.severity === "hard").length : 0;
}

const sameTeam = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * Legal fixes for one violation, best (least destructive) first, or [] if none exists.
 * Each fix's project strictly reduces the hard count. Only the movable single-class
 * normal placement behind the violation is touched (joint/team/pinned are never moved).
 */
export function suggestFixes(project: Project, timetable: Timetable, v: Violation): Fix[] {
  const profile = findProfile(project, timetable);
  const act = actionablePlacement(project, timetable, v);
  if (!profile || !act) return [];
  const ttId = timetable.id;
  const { classId, day, slot } = act;
  const event = project.events.find((e) => e.id === act.placement.eventId)!;
  const subjectName = project.subjects.find((s) => s.id === event.subjectId)?.name ?? event.subjectId;
  const before = hardOf(project, ttId);
  const fixes: Fix[] = [];

  // 1. Reassign — keep the lesson, swap in another qualified+available teacher (fixes
  //    qualification/availability clashes without moving anything).
  for (const o of legalOptions(project, ttId, classId, day, slot)) {
    if (o.subjectId !== event.subjectId || sameTeam(o.teacherIds, event.teacherIds)) continue;
    const after = placeNormalLesson(project, ttId, classId, day, slot, o.subjectId, o.teacherIds);
    if (hardOf(after, ttId) < before) {
      fixes.push({ label: `Reassign to ${o.label}`, project: after });
      break;
    }
  }

  // 2. Move — relocate the lesson to the first legal free slot (resolves a slot clash).
  let moved: Project | null = null;
  let movedLabel = "";
  for (const d of profile.days) {
    for (const s of teachingSlots(profile)) {
      if (d === day && s === slot) continue;
      const candidate = canMove(project, ttId, { classId, day, slot }, { classId, day: d, slot: s });
      if (candidate && hardOf(candidate, ttId) < before) {
        moved = candidate;
        movedLabel = `Move ${subjectName} to ${d} ${slotLabel(profile, s)}`;
        break;
      }
    }
    if (moved) break;
  }
  if (moved) fixes.push({ label: movedLabel, project: moved });

  // 3. Clear — the universal fallback. Removing a placement is monotonic: it can only
  //    remove clashes, never add one.
  const cleared = clearCell(project, ttId, classId, day, slot);
  if (hardOf(cleared, ttId) < before) {
    fixes.push({ label: `Remove ${subjectName} (${day} ${slotLabel(profile, slot)})`, project: cleared });
  }

  return fixes;
}
