import { describe, expect, it } from "vitest";
import { buildBundledProject } from "../fixtures/bundled";
import { findProfile } from "./derive";
import { occupiedSlots, teachingSlots } from "./profile";
import { clashReport, freeCellCount, subjectCountReport, workloadReport } from "./reports";
import type { Id, Project } from "./types";

const tableOf = (p: Project) => p.timetables.find((t) => t.id === p.activeTimetableId)!;

describe("reports reconcile with the grid (derive)", () => {
  const project = buildBundledProject();
  const tt = tableOf(project);
  const profile = findProfile(project, tt)!;

  it("workload periods + free sum to each teacher's available slots", () => {
    for (const row of workloadReport(project, tt)) {
      const teacher = project.teachers.find((t) => t.id === row.teacherId)!;
      const blocked = new Set(teacher.unavailable.map((u) => `${u.day}#${u.slot}`));
      let available = 0;
      for (const day of profile.days) for (const slot of teachingSlots(profile)) if (!blocked.has(`${day}#${slot}`)) available++;
      expect(row.periods + row.free).toBe(available);
    }
  });

  it("per-class subject counts sum to that class's total placed periods (independent recompute)", () => {
    // Independent: count occupied teaching cells per class straight from placements.
    const eventIndex = new Map(project.events.map((e) => [e.id, e]));
    const occByClass = new Map<Id, number>();
    for (const p of tt.placements) {
      const ev = eventIndex.get(p.eventId);
      const slots = ev && occupiedSlots(profile, p.slot, ev.duration);
      if (!ev || !slots) continue;
      for (const c of ev.classIds) occByClass.set(c, (occByClass.get(c) ?? 0) + slots.length);
    }
    for (const row of subjectCountReport(project, tt)) {
      const total = row.counts.reduce((s, c) => s + c.periods, 0);
      expect(total).toBe(occByClass.get(row.classId) ?? 0);
    }
  });

  it("the bundled timetable reports zero clashes and a non-negative free-cell count", () => {
    expect(clashReport(project, tt)).toEqual([]);
    expect(freeCellCount(project, tt)).toBeGreaterThanOrEqual(0);
  });
});
