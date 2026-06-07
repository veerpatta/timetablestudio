// Legal swap finder (PURE) — powers drag-with-auto-swap and the "show legal swaps"
// list (RB2). Dropping a lesson on an occupied slot should offer the clean exchange
// ("Swap with Class 7 Maths? both stay valid"), never an error or a silent clash.
//
// canSwap is the atomic predicate both UX ride on: it applies the swap and accepts it
// ONLY if it introduces zero new hard violations (validate() is the oracle, same bar
// as the legal-only picker). Swaps stay WITHIN one class's week and only exchange two
// NORMAL lessons — a shared joint/team cell is never swapped through this path (it
// would silently move every member class; the picker handles those explicitly).

import { deriveMaps, findProfile, slotKey } from "./derive";
import { movePlacement, placementsCovering, swapPlacements } from "./edit";
import { isTeachingSlot, teachingSlots } from "./profile";
import { validate } from "./validate";
import type { Day, Id, Placement, Project, TimetableEvent } from "./types";

export interface Cell {
  classId: Id;
  day: Day;
  slot: number;
}

export interface Swap {
  /** The partner cell the source would exchange with. */
  target: Cell;
  /** The project AFTER applying this swap (clash-free by construction). */
  project: Project;
  /** Plain label for the partner lesson, e.g. "Maths — Bindu (Tue P2)". */
  label: string;
}

function getTimetable(project: Project, timetableId: Id) {
  return project.timetables.find((t) => t.id === timetableId);
}

function hardCount(project: Project, timetableId: Id): number {
  const tt = getTimetable(project, timetableId);
  if (!tt) return 0;
  return validate(project, tt).filter((v) => v.severity === "hard").length;
}

/** The single NORMAL placement occupying (cell), or null (empty, shared, or 0/2+). */
function normalPlacementAt(project: Project, timetableId: Id, cell: Cell): Placement | null {
  const covering = placementsCovering(project, timetableId, cell.classId, cell.day, cell.slot);
  if (covering.length !== 1) return null;
  const placement = covering[0]!;
  const event = project.events.find((e) => e.id === placement.eventId);
  if (!event || event.classIds.length > 1) return null; // shared (joint/team) → never swap here
  return placement;
}

function eventLabel(project: Project, event: TimetableEvent): string {
  const sName = project.subjects.find((s) => s.id === event.subjectId)?.name ?? event.subjectId;
  const who = event.teacherIds.map((t) => project.teachers.find((x) => x.id === t)?.name ?? t).join(", ");
  return who ? `${sName} — ${who}` : sName;
}

/**
 * Try to exchange the two cells' placements. Returns the swapped project + a label, or
 * null if the swap is illegal (would add a hard violation), the cells are the same, or
 * either cell is empty / non-teaching / a shared event. Accepts the swap only if the
 * resulting hard-violation count does not exceed the count before — so on the bundled
 * (0-clash) timetable, only fully clash-free swaps are ever offered.
 */
export function canSwap(project: Project, timetableId: Id, a: Cell, b: Cell): Swap | null {
  if (a.classId !== b.classId || (a.day === b.day && a.slot === b.slot)) return null;
  const tt = getTimetable(project, timetableId);
  const profile = tt && findProfile(project, tt);
  if (!tt || !profile) return null;
  if (!isTeachingSlot(profile, a.slot) || !isTeachingSlot(profile, b.slot)) return null;

  const pa = normalPlacementAt(project, timetableId, a);
  const pb = normalPlacementAt(project, timetableId, b);
  if (!pa || !pb) return null;

  const before = hardCount(project, timetableId);
  const after = swapPlacements(project, timetableId, pa, pb);
  if (hardCount(after, timetableId) > before) return null;

  const partnerEvent = project.events.find((e) => e.id === pb.eventId)!;
  return { target: b, project: after, label: eventLabel(project, partnerEvent) };
}

/**
 * Move the normal lesson at `source` into the EMPTY slot `target` (same class), if that
 * keeps the timetable legal. Returns the moved project or null. The drag path uses this
 * for a drop on a free slot; canSwap handles a drop on an occupied slot. A shared
 * (joint/team) cell is never moved here (normalPlacementAt rejects it).
 */
export function canMove(project: Project, timetableId: Id, source: Cell, target: Cell): Project | null {
  if (source.classId !== target.classId) return null;
  if (source.day === target.day && source.slot === target.slot) return null;
  const tt = getTimetable(project, timetableId);
  const profile = tt && findProfile(project, tt);
  if (!tt || !profile) return null;
  if (!isTeachingSlot(profile, source.slot) || !isTeachingSlot(profile, target.slot)) return null;

  const ps = normalPlacementAt(project, timetableId, source);
  if (!ps) return null;
  // Target must be empty for this class (a drop on an occupied slot is a swap, not a move).
  if (deriveMaps(project, tt).classCells.get(target.classId)?.has(slotKey(target.day, target.slot))) return null;

  const before = hardCount(project, timetableId);
  const after = movePlacement(project, timetableId, ps, target.day, target.slot);
  if (hardCount(after, timetableId) > before) return null;
  return after;
}

/**
 * Every legal exchange for the lesson at (classId, day, slot): the source must be an
 * occupied normal cell; partners are the class's other occupied normal cells across the
 * week whose swap keeps everything valid. Deterministic order (day, then slot).
 */
export function legalSwaps(
  project: Project,
  timetableId: Id,
  classId: Id,
  day: Day,
  slot: number,
): Swap[] {
  const tt = getTimetable(project, timetableId);
  const profile = tt && findProfile(project, tt);
  if (!tt || !profile) return [];
  if (!normalPlacementAt(project, timetableId, { classId, day, slot })) return [];

  const maps = deriveMaps(project, tt);
  const byClass = maps.classCells.get(classId);
  const out: Swap[] = [];
  for (const d of profile.days) {
    for (const s of teachingSlots(profile)) {
      if (d === day && s === slot) continue;
      if (!byClass?.has(slotKey(d, s))) continue; // partner must be occupied
      const swap = canSwap(project, timetableId, { classId, day, slot }, { classId, day: d, slot: s });
      if (swap) {
        const label = `${swap.label} (${d} ${profile.slots.find((x) => x.index === s)?.label ?? s})`;
        out.push({ ...swap, label });
      }
    }
  }
  return out;
}
