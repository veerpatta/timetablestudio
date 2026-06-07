// Derived selectors over a Timetable (PURE — no DOM/IndexedDB/window).
//
// A Placement pins an event to (day, startSlot). We expand placements into atomic
// per-(entity, day, slot) occupancies so the three views (class / teacher / day)
// and clash detection all read one structure. Each occupancy carries its
// `eventId` — that is what makes joint_class / team_block overlaps legal: a clash
// is >1 DISTINCT eventId in a slot, never just >1 occupancy (docs/REBUILD.md §clash).

import { occupiedSlots } from "./profile";
import type {
  Day,
  Id,
  Placement,
  Profile,
  Project,
  Timetable,
  TimetableEvent,
} from "./types";

/** One entity's occupancy of one (day, slot) by one placement of one event. */
export interface Occupancy {
  day: Day;
  slot: number;
  eventId: Id;
  event: TimetableEvent;
  pinned: boolean;
}

/** `${day}#${slot}` */
export type SlotKey = string;
export const slotKey = (day: Day, slot: number): SlotKey => `${day}#${slot}`;

export function buildEventIndex(project: Project): Map<Id, TimetableEvent> {
  const index = new Map<Id, TimetableEvent>();
  for (const e of project.events) index.set(e.id, e);
  return index;
}

export function findProfile(project: Project, timetable: Timetable): Profile | undefined {
  return project.profiles.find((p) => p.id === timetable.profileId);
}

/**
 * The slot indices a placement occupies, or null if it overflows the day / starts
 * on a non-teaching slot. Reads the event's `duration`; skips fixed slots (Recess).
 */
export function placementSlots(
  profile: Profile,
  placement: Placement,
  event: TimetableEvent,
): number[] | null {
  return occupiedSlots(profile, placement.slot, event.duration);
}

export interface DerivedMaps {
  /** classId -> slotKey -> occupancies (>1 distinct eventId ⇒ HE2 class clash). */
  classCells: Map<Id, Map<SlotKey, Occupancy[]>>;
  /** teacherId -> slotKey -> occupancies (>1 distinct eventId ⇒ HE1 teacher clash). */
  teacherCells: Map<Id, Map<SlotKey, Occupancy[]>>;
  /** day -> slotKey -> placements (the whole-school day view). */
  daySlots: Map<Day, Map<SlotKey, Placement[]>>;
  eventIndex: Map<Id, TimetableEvent>;
}

function pushNested<V>(map: Map<Id, Map<SlotKey, V[]>>, outer: Id, key: SlotKey, value: V): void {
  let inner = map.get(outer);
  if (!inner) {
    inner = new Map();
    map.set(outer, inner);
  }
  const arr = inner.get(key);
  if (arr) arr.push(value);
  else inner.set(key, [value]);
}

/** Build class-, teacher-, and day-occupancy maps for a timetable. */
export function deriveMaps(project: Project, timetable: Timetable): DerivedMaps {
  const eventIndex = buildEventIndex(project);
  const profile = findProfile(project, timetable);
  const classCells: DerivedMaps["classCells"] = new Map();
  const teacherCells: DerivedMaps["teacherCells"] = new Map();
  const daySlots: DerivedMaps["daySlots"] = new Map();

  for (const placement of timetable.placements) {
    const event = eventIndex.get(placement.eventId);
    if (!event || !profile) continue; // dangling placement / unknown profile
    const slots = placementSlots(profile, placement, event);
    if (!slots) continue; // out-of-bounds placement; flagged by validate (HE7)

    const classIds = [...new Set(event.classIds)];
    const teacherIds = [...new Set(event.teacherIds)];

    for (const slot of slots) {
      const dayMap = daySlots.get(placement.day) ?? new Map<SlotKey, Placement[]>();
      const dk = slotKey(placement.day, slot);
      const dArr = dayMap.get(dk);
      if (dArr) dArr.push(placement);
      else dayMap.set(dk, [placement]);
      daySlots.set(placement.day, dayMap);

      const occ: Occupancy = {
        day: placement.day,
        slot,
        eventId: event.id,
        event,
        pinned: placement.pinned,
      };
      for (const classId of classIds) pushNested(classCells, classId, dk, occ);
      // Teacher occupancy is per (teacher × slot), once — an ELGA block occupies
      // each teacher once per slot, not once per class.
      for (const teacherId of teacherIds) pushNested(teacherCells, teacherId, dk, occ);
    }
  }

  return { classCells, teacherCells, daySlots, eventIndex };
}

/** Distinct eventIds among occupancies — the clash test (>1 ⇒ real clash). */
export function distinctEventIds(occ: Occupancy[]): Id[] {
  return [...new Set(occ.map((o) => o.eventId))];
}
