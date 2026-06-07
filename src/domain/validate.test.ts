import { describe, expect, it } from "vitest";
import { makeMiniSchool } from "../fixtures/synthetic";
import type { Placement, Project, Timetable } from "./types";
import { validate } from "./validate";

function withPlacements(project: Project, placements: Placement[]): Timetable {
  return { ...project.timetables[0]!, placements };
}
const ids = (project: Project, placements: Placement[]) =>
  validate(project, withPlacements(project, placements)).map((v) => v.constraintId);

describe("event-model clash logic (the heart of RB0)", () => {
  it("a senior joint class (3 classes, 1 teacher) in one slot is NOT a clash", () => {
    const project = makeMiniSchool();
    // English to all three Class-11 streams, Mon P1 (slot 1).
    const v = validate(
      project,
      withPlacements(project, [{ eventId: "evt-eng11", day: "Mon", slot: 1, pinned: false }]),
    );
    expect(v).toEqual([]);
  });

  it("the ELGA team block (5 classes × 5 teachers) in one slot is NOT a clash", () => {
    const project = makeMiniSchool();
    // ELGA Mon starting P3 (slot 3), duration 3 → occupies P3,P4,P5.
    const v = validate(
      project,
      withPlacements(project, [{ eventId: "evt-elga", day: "Mon", slot: 3, pinned: false }]),
    );
    expect(v).toEqual([]);
  });

  it("ELGA and the joint class coexist all week with zero clashes", () => {
    const project = makeMiniSchool();
    const placements: Placement[] = [
      { eventId: "evt-elga", day: "Mon", slot: 3, pinned: true },
      { eventId: "evt-elga", day: "Tue", slot: 3, pinned: true },
      { eventId: "evt-eng11", day: "Mon", slot: 1, pinned: false },
      { eventId: "evt-eng11", day: "Tue", slot: 7, pinned: false },
    ];
    expect(validate(project, withPlacements(project, placements))).toEqual([]);
  });

  it("two DIFFERENT events putting one teacher in the same slot IS exactly one clash", () => {
    const project = makeMiniSchool();
    // Nidhika teaches Class 1 Maths and Class 2 Maths at Mon P1 — real HE1 clash.
    const v = validate(
      project,
      withPlacements(project, [
        { eventId: "evt-maths-c1", day: "Mon", slot: 1, pinned: false },
        { eventId: "evt-maths-c2", day: "Mon", slot: 1, pinned: false },
      ]),
    );
    const teacherClashes = v.filter((x) => x.constraintId === "HE1");
    expect(teacherClashes).toHaveLength(1);
    expect(teacherClashes[0]!.message).toContain("Nidhika");
  });

  it("the same event placed twice in a slot is legal (same eventId, not a clash)", () => {
    const project = makeMiniSchool();
    const v = validate(
      project,
      withPlacements(project, [
        { eventId: "evt-maths-c1", day: "Mon", slot: 1, pinned: false },
        { eventId: "evt-maths-c1", day: "Mon", slot: 1, pinned: false },
      ]),
    );
    expect(v.filter((x) => x.constraintId === "HE1" || x.constraintId === "HE2")).toEqual([]);
  });

  it("a class double-booked by two different events is exactly one HE2 clash", () => {
    const project = makeMiniSchool();
    // ELGA (covers Class 1) overlaps Class 1 Maths at Mon P3.
    const v = ids(project, [
      { eventId: "evt-elga", day: "Mon", slot: 3, pinned: false },
      { eventId: "evt-maths-c1", day: "Mon", slot: 3, pinned: false },
    ]);
    expect(v.filter((c) => c === "HE2")).toHaveLength(1);
  });
});

describe("other hard constraints", () => {
  it("HE3: an unqualified teacher is rejected", () => {
    const project = makeMiniSchool();
    // Reassign Class-1 Maths to Pradhyuman, who is not qualified for it.
    project.events.find((e) => e.id === "evt-maths-c1")!.teacherIds = ["pEng"];
    const v = ids(project, [{ eventId: "evt-maths-c1", day: "Mon", slot: 1, pinned: false }]);
    expect(v).toContain("HE3");
  });

  it("HE4: a teacher placed in an unavailable slot is rejected", () => {
    const project = makeMiniSchool();
    project.teachers.find((t) => t.id === "mMaths")!.unavailable = [{ day: "Mon", slot: 1 }];
    const v = ids(project, [{ eventId: "evt-maths-c1", day: "Mon", slot: 1, pinned: false }]);
    expect(v).toContain("HE4");
  });

  it("HE5: an event on Recess (a non-teaching slot) is rejected", () => {
    const project = makeMiniSchool();
    const v = ids(project, [{ eventId: "evt-maths-c1", day: "Mon", slot: 5, pinned: false }]);
    expect(v).toContain("HE5");
  });

  it("HE7: a double period starting at the last slot overflows the day", () => {
    const project = makeMiniSchool();
    project.events.find((e) => e.id === "evt-maths-c1")!.duration = 2;
    const v = ids(project, [{ eventId: "evt-maths-c1", day: "Mon", slot: 9, pinned: false }]);
    expect(v).toContain("HE7");
  });

  it("a clean, fully-placed mini week has zero violations", () => {
    const project = makeMiniSchool();
    const placements: Placement[] = [
      { eventId: "evt-elga", day: "Mon", slot: 3, pinned: true },
      { eventId: "evt-eng11", day: "Mon", slot: 1, pinned: false },
      { eventId: "evt-maths-c1", day: "Mon", slot: 2, pinned: false },
      { eventId: "evt-maths-c2", day: "Mon", slot: 7, pinned: false },
    ];
    expect(validate(project, withPlacements(project, placements))).toEqual([]);
  });
});
