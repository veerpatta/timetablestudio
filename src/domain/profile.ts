// The fixed time grid (PURE). A Profile is Assembly + N teaching periods + a
// positioned Recess. The REGULAR 2026-27 profile is the default per docs/REBUILD.md.
//
// Slot indices are array positions in PHYSICAL time order, so Recess sits between
// P4 and P5 (index 5) — teaching periods P1..P8 are therefore NOT contiguous slot
// indices (P4=4, Recess=5, P5=6). Events occupy `duration` consecutive *teaching*
// slots, skipping the recess. See docs/sources/VPPS_Timetable_Analysis_2026-27.md §1.

import type { Day, Profile, SlotDef } from "./types";

export const ALL_DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const REGULAR_PROFILE_ID = "profile-regular";

// The authoritative 2026-27 clock (analysis §1): 40-min periods, Recess 11:10–11:30.
const REGULAR_SLOTS: SlotDef[] = [
  { index: 0, label: "Assembly", start: "08:00", end: "08:30", teaching: false },
  { index: 1, label: "P1", start: "08:30", end: "09:10", teaching: true },
  { index: 2, label: "P2", start: "09:10", end: "09:50", teaching: true },
  { index: 3, label: "P3", start: "09:50", end: "10:30", teaching: true },
  { index: 4, label: "P4", start: "10:30", end: "11:10", teaching: true },
  { index: 5, label: "Recess", start: "11:10", end: "11:30", teaching: false },
  { index: 6, label: "P5", start: "11:30", end: "12:10", teaching: true },
  { index: 7, label: "P6", start: "12:10", end: "12:50", teaching: true },
  { index: 8, label: "P7", start: "12:50", end: "13:30", teaching: true },
  { index: 9, label: "P8", start: "13:30", end: "14:10", teaching: true },
];

/** The real 8-period 2026-27 grid — the bundled default (docs/REBUILD.md decision 1). */
export function buildRegularProfile(): Profile {
  return {
    id: REGULAR_PROFILE_ID,
    name: "Regular 2026-27",
    days: [...ALL_DAYS],
    slots: REGULAR_SLOTS.map((s) => ({ ...s })),
    isDefault: true,
  };
}

/** Teaching slot indices in order, e.g. regular = [1,2,3,4,6,7,8,9]. */
export function teachingSlots(profile: Profile): number[] {
  return profile.slots.filter((s) => s.teaching).map((s) => s.index);
}

export function slotDef(profile: Profile, index: number): SlotDef | undefined {
  return profile.slots.find((s) => s.index === index);
}

export function isTeachingSlot(profile: Profile, index: number): boolean {
  return slotDef(profile, index)?.teaching ?? false;
}

/** Human label for a slot index ("P3", "Recess"), or the raw index if unknown. */
export function slotLabel(profile: Profile, index: number): string {
  return slotDef(profile, index)?.label ?? `slot ${index}`;
}

/**
 * The slot indices a duration-d event occupies when started at `startSlot`:
 * `startSlot` plus the next d-1 TEACHING slots (Recess and other fixed slots are
 * skipped, never occupied). Returns null if the event runs off the end of the day
 * (fewer than d teaching slots remain) or `startSlot` is not a teaching slot.
 */
export function occupiedSlots(
  profile: Profile,
  startSlot: number,
  duration: number,
): number[] | null {
  if (duration < 1) return null;
  const teaching = teachingSlots(profile);
  const start = teaching.indexOf(startSlot);
  if (start < 0) return null; // startSlot is Assembly/Recess or out of range
  if (start + duration > teaching.length) return null; // overflows the day
  return teaching.slice(start, start + duration);
}
