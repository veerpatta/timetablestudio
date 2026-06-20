import { describe, expect, it } from "vitest";
import { buildBundledProject } from "../fixtures/bundled";
import { restoreClassFromReference } from "./restore";
import { validate } from "./validate";
import type { Project } from "./types";

// The single-class electives the old bug actually stripped (Economics is a joint Arts+Commerce
// class, so it was never destroyed — and isn't this per-class restore's job).
const STRIPPED_ELECTIVES = ["Political Science", "Geography", "English Literature"];

function placementsOf(project: Project, classId: string, subjectId: string): number {
  const tt = project.timetables.find((t) => t.id === project.activeTimetableId)!;
  const byId = new Map(project.events.map((e) => [e.id, e]));
  return tt.placements.filter((p) => {
    const e = byId.get(p.eventId);
    return e?.subjectId === subjectId && e.classIds.includes(classId);
  }).length;
}

/** Reproduce the old bug's damage: drop a class's single-class elective placements,
 *  leaving its Self Study behind — exactly the corrupted state the bug persisted. */
function damageElectives(project: Project, classId: string): Project {
  const tt = project.timetables.find((t) => t.id === project.activeTimetableId)!;
  const byId = new Map(project.events.map((e) => [e.id, e]));
  return {
    ...project,
    timetables: project.timetables.map((t) =>
      t.id !== tt.id
        ? t
        : {
            ...t,
            placements: t.placements.filter((p) => {
              const e = byId.get(p.eventId);
              return !(e && STRIPPED_ELECTIVES.includes(e.subjectId) && e.classIds.length === 1 && e.classIds[0] === classId);
            }),
          },
    ),
  };
}

describe("restoreClassFromReference", () => {
  it("restores a class whose electives were destroyed by the Self Study bug", () => {
    const reference = buildBundledProject();
    const ttId = reference.activeTimetableId!;
    const cls = "Class 12 Arts";

    // sanity: the reference has the electives
    for (const sub of STRIPPED_ELECTIVES) expect(placementsOf(reference, cls, sub)).toBeGreaterThan(0);
    const economicsBefore = placementsOf(reference, cls, "Economics");

    const damaged = damageElectives(reference, cls);
    for (const sub of STRIPPED_ELECTIVES) expect(placementsOf(damaged, cls, sub)).toBe(0); // confirmed destroyed

    const restored = restoreClassFromReference(damaged, buildBundledProject(), cls, ttId);
    for (const sub of STRIPPED_ELECTIVES) expect(placementsOf(restored, cls, sub)).toBeGreaterThan(0); // back
    expect(placementsOf(restored, cls, "Economics")).toBe(economicsBefore); // joint elective untouched

    const tt = restored.timetables.find((t) => t.id === ttId)!;
    expect(validate(restored, tt).filter((v) => v.severity === "hard")).toEqual([]); // still clash-free
  });

  it("does not disturb other classes", () => {
    const reference = buildBundledProject();
    const ttId = reference.activeTimetableId!;
    const before = placementsOf(reference, "Class 11 Arts", "Geography");
    const damaged = damageElectives(reference, "Class 12 Arts");
    const restored = restoreClassFromReference(damaged, buildBundledProject(), "Class 12 Arts", ttId);
    expect(placementsOf(restored, "Class 11 Arts", "Geography")).toBe(before);
  });
});
