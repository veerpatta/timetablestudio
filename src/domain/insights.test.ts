import { describe, expect, it } from "vitest";
import { buildBundledProject } from "../fixtures/bundled";
import { findProfile } from "./derive";
import { allTeacherLoads, freeTeachers, loadBalance, teacherLoad } from "./insights";
import { occupiedSlots, teachingSlots } from "./profile";
import type { Day, Id, Project, Timetable } from "./types";

/** INDEPENDENT oracle: per-teacher occupied (day#slot) set, straight from placements
 *  (no deriveMaps), expanding each event over its teaching slots × teachers. */
function recomputeOccupied(project: Project, tt: Timetable): Map<Id, Set<string>> {
  const profile = findProfile(project, tt)!;
  const eventIndex = new Map(project.events.map((e) => [e.id, e]));
  const m = new Map<Id, Set<string>>();
  for (const p of tt.placements) {
    const ev = eventIndex.get(p.eventId);
    if (!ev) continue;
    const slots = occupiedSlots(profile, p.slot, ev.duration);
    if (!slots) continue;
    for (const s of slots) {
      for (const t of ev.teacherIds) {
        if (!m.has(t)) m.set(t, new Set());
        m.get(t)!.add(`${p.day}#${s}`);
      }
    }
  }
  return m;
}

describe("insights numbers equal an independent recomputation (property)", () => {
  const project = buildBundledProject();
  const tt = project.timetables.find((t) => t.id === project.activeTimetableId)!;
  const occupied = recomputeOccupied(project, tt);

  it("teacherLoad.used matches the placement-derived count for every teacher", () => {
    for (const t of project.teachers) {
      expect(teacherLoad(project, tt, t.id).used).toBe(occupied.get(t.id)?.size ?? 0);
    }
  });

  it("free = available − used and balance reflects the per-teacher loads", () => {
    for (const l of allTeacherLoads(project, tt)) expect(l.free).toBe(Math.max(0, l.available - l.used));
    const loads = allTeacherLoads(project, tt).map((l) => l.used);
    const b = loadBalance(project, tt);
    expect(b.min).toBe(Math.min(...loads));
    expect(b.max).toBe(Math.max(...loads));
    expect(b.spread).toBe(b.max - b.min);
  });
});

describe("free-teacher finder excludes anyone occupied (incl. ELGA team + senior joint)", () => {
  const project = buildBundledProject();
  const tt = project.timetables.find((t) => t.id === project.activeTimetableId)!;
  const profile = findProfile(project, tt)!;
  const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const occupied = recomputeOccupied(project, tt);

  it("never returns a teacher who is in any event at that slot", () => {
    for (const day of DAYS) {
      for (const slot of teachingSlots(profile)) {
        const free = new Set(freeTeachers(project, tt, day, slot));
        for (const teacherId of free) {
          expect(occupied.get(teacherId)?.has(`${day}#${slot}`) ?? false).toBe(false);
        }
      }
    }
  });

  it("excludes ELGA team teachers during the block and senior-joint teachers during the joint class", () => {
    // ELGA runs Mon P3 (slot 3): all five primary teachers are busy in the team_block.
    const elgaFree = freeTeachers(project, tt, "Mon", 3);
    for (const t of ["Bindu", "Anita", "Rashmita", "Kusum", "Ravina"]) expect(elgaFree).not.toContain(t);
    // Class 11 joint English (Pradhyuman) at Mon P4 (slot 4): he's busy across all 3 streams.
    expect(freeTeachers(project, tt, "Mon", 4)).not.toContain("Pradhyuman");
  });

  it("excludes a teacher who is unavailable then (Mahesh after recess) and returns [] for Recess", () => {
    for (const slot of [6, 7, 8, 9]) expect(freeTeachers(project, tt, "Mon", slot)).not.toContain("Mahesh");
    expect(freeTeachers(project, tt, "Mon", 5)).toEqual([]); // Recess = non-teaching
  });
});
