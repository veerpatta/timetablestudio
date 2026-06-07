// Placement-granular edits (PURE, immutable: every fn returns a NEW Project).
//
// CRITICAL: an event is SHARED across its placements ("Class 1 Maths/Bindu" is one
// event placed ~10×). Edits therefore operate on PLACEMENTS, never by mutating an
// event in place — re-point / insert / remove a Placement, and reuse-or-create the
// target event by signature (ensureEvent). Clearing or replacing one cell must leave
// every other placement of the former event untouched (edit.test.ts asserts this).

import { findProfile, placementSlots } from "./derive";
import { occupiedSlots } from "./profile";
import type { Day, EventType, Id, Placement, Project, TimetableEvent } from "./types";

/** Canonical signature so identical lessons reuse one event. */
export function eventSignature(e: Pick<TimetableEvent, "type" | "subjectId" | "teacherIds" | "classIds">): string {
  return [e.type, e.subjectId, [...e.teacherIds].sort().join(","), [...e.classIds].sort().join("+")].join("|");
}

function withTimetable(project: Project, timetableId: Id, fn: (placements: Placement[]) => Placement[]): {
  placements: Placement[];
} {
  const tt = project.timetables.find((t) => t.id === timetableId);
  if (!tt) return { placements: [] };
  return { placements: fn(tt.placements) };
}

/** Find an event matching a signature, or null. */
export function findEventBySignature(project: Project, sig: string): TimetableEvent | null {
  return project.events.find((e) => eventSignature(e) === sig) ?? null;
}

/** Reuse-or-create an event; returns the (possibly extended) events array + the id. */
function ensureEvent(
  events: TimetableEvent[],
  spec: { type: EventType; subjectId: Id; teacherIds: Id[]; classIds: Id[]; duration: number },
): { events: TimetableEvent[]; eventId: Id } {
  const sig = eventSignature(spec);
  const existing = events.find((e) => eventSignature(e) === sig);
  if (existing) return { events, eventId: existing.id };
  const id = `evt:${sig}`;
  const event: TimetableEvent = { id, source: "manual", ...spec };
  return { events: [...events, event], eventId: id };
}

/** All placements whose event covers (classId, day, slot). */
export function placementsCovering(project: Project, timetableId: Id, classId: Id, day: Day, slot: number): Placement[] {
  const tt = project.timetables.find((t) => t.id === timetableId);
  const profile = tt && findProfile(project, tt);
  if (!tt || !profile) return [];
  const eventIndex = new Map(project.events.map((e) => [e.id, e]));
  return tt.placements.filter((p) => {
    if (p.day !== day) return false;
    const ev = eventIndex.get(p.eventId);
    if (!ev || !ev.classIds.includes(classId)) return false;
    const slots = placementSlots(profile, p, ev);
    return slots?.includes(slot) ?? false;
  });
}

/**
 * Remove whatever occupies (classId, day, slot). The removed PLACEMENT may belong to
 * a joint/team event — clearing then removes that whole placement (all member classes),
 * because a single event can't be half-placed. Other placements of the event survive.
 */
export function clearCell(project: Project, timetableId: Id, classId: Id, day: Day, slot: number): Project {
  const covering = new Set(placementsCovering(project, timetableId, classId, day, slot));
  if (covering.size === 0) return project;
  const { placements } = withTimetable(project, timetableId, (ps) => ps.filter((p) => !covering.has(p)));
  return writeTimetable(project, timetableId, placements);
}

/** Place a single-class normal lesson at (classId, day, slot), replacing any current cell. */
export function placeNormalLesson(
  project: Project,
  timetableId: Id,
  classId: Id,
  day: Day,
  slot: number,
  subjectId: Id,
  teacherIds: Id[],
): Project {
  const cleared = clearCell(project, timetableId, classId, day, slot);
  const { events, eventId } = ensureEvent(cleared.events, {
    type: "normal",
    subjectId,
    teacherIds,
    classIds: [classId],
    duration: 1,
  });
  const withEvent: Project = { ...cleared, events };
  const placement: Placement = { eventId, day, slot, pinned: false };
  const { placements } = withTimetable(withEvent, timetableId, (ps) => [...ps, placement]);
  return writeTimetable(withEvent, timetableId, placements);
}

/** Move an existing placement to a new (day, slot) — used by drag. Pure. */
export function movePlacement(
  project: Project,
  timetableId: Id,
  placement: Placement,
  day: Day,
  slot: number,
): Project {
  const { placements } = withTimetable(project, timetableId, (ps) =>
    ps.map((p) => (p === placement ? { ...p, day, slot } : p)),
  );
  return writeTimetable(project, timetableId, placements);
}

/**
 * Exchange the (day, slot) of two placements in ONE pass. Used by drag-with-auto-swap
 * (RB2). Pure: returns a new Project; the events are untouched (a swap only moves the
 * two placements). Both placements must belong to this timetable.
 */
export function swapPlacements(
  project: Project,
  timetableId: Id,
  a: Placement,
  b: Placement,
): Project {
  const { placements } = withTimetable(project, timetableId, (ps) =>
    ps.map((p) => {
      if (p === a) return { ...p, day: b.day, slot: b.slot };
      if (p === b) return { ...p, day: a.day, slot: a.slot };
      return p;
    }),
  );
  return writeTimetable(project, timetableId, placements);
}

function writeTimetable(project: Project, timetableId: Id, placements: Placement[]): Project {
  return {
    ...project,
    timetables: project.timetables.map((t) => (t.id === timetableId ? { ...t, placements } : t)),
  };
}

/** Re-export for callers building duration-aware placements. */
export { occupiedSlots };
