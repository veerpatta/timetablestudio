// Ghost autocomplete (PURE) — the faint best-legal suggestion shown in an empty
// teaching slot (RB2). Click to accept, like tab-completion for a timetable.
//
// "Best" is the legal option whose subject the class is most SHORT on this week
// (requirement periodsPerWeek minus what's already placed). It is ALWAYS one of
// legalOptions(), so a ghost can never be unqualified or clashing — legality first,
// shortfall only ranks among the legal candidates. Returns null when the slot is not
// an empty teaching slot, or no legal option fills an actual shortfall.

import { deriveMaps, findProfile, slotKey } from "./derive";
import { legalOptions, type Candidate } from "./legalMoves";
import { isTeachingSlot } from "./profile";
import type { Day, Id, Project } from "./types";

/** Periods already placed of each subject for a class (a duration-2 lesson counts 2). */
function placedBySubject(project: Project, timetableId: Id, classId: Id): Map<Id, number> {
  const tt = project.timetables.find((t) => t.id === timetableId);
  const counts = new Map<Id, number>();
  if (!tt) return counts;
  const byClass = deriveMaps(project, tt).classCells.get(classId);
  if (!byClass) return counts;
  for (const occ of byClass.values()) {
    const subjectId = occ[0]?.event.subjectId;
    if (subjectId) counts.set(subjectId, (counts.get(subjectId) ?? 0) + 1);
  }
  return counts;
}

/**
 * The single best legal lesson to drop into (classId, day, slot): among legalOptions,
 * the one whose subject has the largest positive weekly shortfall (tie-break by the
 * option's label, which legalOptions already sorts). Null if the slot is occupied /
 * non-teaching, or nothing legal addresses a shortfall.
 */
export function ghostSuggestion(
  project: Project,
  timetableId: Id,
  classId: Id,
  day: Day,
  slot: number,
): Candidate | null {
  const tt = project.timetables.find((t) => t.id === timetableId);
  const profile = tt && findProfile(project, tt);
  if (!tt || !profile || !isTeachingSlot(profile, slot)) return null;

  // Only suggest into a genuinely EMPTY slot for this class.
  const byClass = deriveMaps(project, tt).classCells.get(classId);
  if (byClass?.has(slotKey(day, slot))) return null;

  const options = legalOptions(project, timetableId, classId, day, slot);
  if (options.length === 0) return null;

  const placed = placedBySubject(project, timetableId, classId);
  const need = new Map<Id, number>();
  for (const r of project.requirements) {
    if (r.classId === classId) need.set(r.subjectId, (need.get(r.subjectId) ?? 0) + r.periodsPerWeek);
  }
  const shortfall = (subjectId: Id) => (need.get(subjectId) ?? 0) - (placed.get(subjectId) ?? 0);

  let best: Candidate | null = null;
  let bestShort = 0; // strictly positive shortfall required
  for (const o of options) {
    const s = shortfall(o.subjectId);
    if (s > bestShort) {
      bestShort = s;
      best = o;
    }
  }
  return best;
}
