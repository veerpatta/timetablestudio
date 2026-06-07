// PURE reverse of buildProject: a v6 Project → the class-wise cell grid
// (className → [day][period] tokens). Used to prove the bundled project round-trips
// to the authoritative REAL_GRID cell-for-cell (realGrid.test.ts).

import { findProfile, placementSlots } from "./derive";
import { teachingSlots } from "./profile";
import type { Day, Project, TimetableEvent } from "./types";

const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function eventToken(event: TimetableEvent): string {
  if (event.type === "team_block") return "ELGA";
  if (event.type === "free") return "Free";
  const who = event.teacherIds.join(",");
  return who ? `${event.subjectId}|${who}` : event.subjectId;
}

/**
 * Reconstruct the class grid from a timetable's placements: 16 classes × 6 days ×
 * 8 periods of tokens (empty string where nothing is placed). The period axis is
 * the regular profile's 8 teaching slots in order.
 */
export function gridFromProject(
  project: Project,
  timetableId = project.activeTimetableId,
): Record<string, string[][]> {
  const tt = project.timetables.find((t) => t.id === timetableId);
  const profile = tt && findProfile(project, tt);
  const grid: Record<string, string[][]> = {};
  for (const c of project.classes) {
    grid[c.id] = Array.from({ length: 6 }, () => Array.from({ length: 8 }, () => ""));
  }
  if (!tt || !profile) return grid;

  const slotToPeriod = new Map<number, number>();
  teachingSlots(profile).forEach((slot, i) => slotToPeriod.set(slot, i));
  const eventIndex = new Map(project.events.map((e) => [e.id, e]));
  const dayIndex = new Map(DAYS.map((d, i) => [d, i]));

  for (const p of tt.placements) {
    const event = eventIndex.get(p.eventId);
    if (!event) continue;
    const slots = placementSlots(profile, p, event);
    if (!slots) continue;
    const di = dayIndex.get(p.day);
    if (di === undefined) continue;
    const token = eventToken(event);
    for (const slot of slots) {
      const period = slotToPeriod.get(slot);
      if (period === undefined) continue;
      for (const classId of event.classIds) {
        if (grid[classId]) grid[classId]![di]![period] = token;
      }
    }
  }
  return grid;
}
