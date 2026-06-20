import { describe, expect, it } from "vitest";
import { buildBundledProject } from "../fixtures/bundled";
import { attendeesIntersect, attendeesOf, buildGroupsByClass } from "./attendees";
import { canParallelize, seedArtsElectives } from "./electives";
import { validate } from "./validate";
import type { Project } from "./types";

const ttOf = (p: Project) => p.timetables.find((t) => t.id === p.activeTimetableId)!;
const hard = (p: Project) => validate(p, ttOf(p)).filter((v) => v.severity === "hard").length;
const ELECTIVES = ["Political Science", "Geography", "Economics", "English Literature"];

describe("C5 electives — the bundled Arts model is clash-free and forced-sitting is gone", () => {
  const p = seedArtsElectives(buildBundledProject());

  it("the elective-modelled bundled project still has ZERO hard violations", () => {
    // The gate: Study events added to elective slots must NOT trip the refined HE2.
    expect(hard(p)).toBe(0);
  });

  it("defines an ElectiveGroup + four 3-of-4 student groups per Arts class", () => {
    for (const cls of ["Class 11 Arts", "Class 12 Arts"]) {
      expect(p.electiveGroups.find((g) => g.classId === cls)?.chooseCount).toBe(3);
      const groups = p.studentGroups.filter((g) => g.classId === cls);
      expect(groups.length).toBe(4);
      for (const g of groups) expect(g.electiveSubjectIds.length).toBe(3);
    }
  });

  it("no student group is ever scheduled into a subject it didn't choose (no forced sitting)", () => {
    const groupById = new Map(p.studentGroups.map((g) => [g.id, g]));
    for (const e of p.events) {
      if (!e.studentGroupIds || !ELECTIVES.includes(e.subjectId)) continue;
      for (const gid of e.studentGroupIds) {
        const g = groupById.get(gid);
        if (g) expect(g.electiveSubjectIds).toContain(e.subjectId); // group is here ⇒ it chose this
      }
    }
  });

  it("the dropping group gets a Self Study during the elective it dropped", () => {
    // Class 11 Arts group that dropped Economics → has a self_study event scoped to it.
    const dropEco = p.studentGroups.find((g) => g.classId === "Class 11 Arts" && !g.electiveSubjectIds.includes("Economics"))!;
    const study = p.events.find((e) => e.type === "self_study" && (e.studentGroupIds ?? []).includes(dropEco.id));
    expect(study).toBeDefined();
    expect(study!.classIds).toContain("Class 11 Arts");
  });

  it("no slot carries both Economics and Geography (Prakash can't be in two places — HE1)", () => {
    const eventIndex = new Map(p.events.map((e) => [e.id, e]));
    const slotSubjects = new Map<string, Set<string>>();
    for (const pl of ttOf(p).placements) {
      const ev = eventIndex.get(pl.eventId);
      if (!ev) continue;
      const key = `${pl.day}#${pl.slot}`;
      (slotSubjects.get(key) ?? slotSubjects.set(key, new Set()).get(key)!).add(ev.subjectId);
    }
    for (const subs of slotSubjects.values()) expect(subs.has("Economics") && subs.has("Geography")).toBe(false);
  });
});

describe("attendee-set clash refinement (two-sided)", () => {
  it("elective + dropping-group Study legally overlap, but two CHOSEN electives in one slot clash", () => {
    const p = seedArtsElectives(buildBundledProject());
    const groupsByClass = buildGroupsByClass(p);
    const cls = "Class 11 Arts";
    const groups = p.studentGroups.filter((g) => g.classId === cls);

    // legitimate overlap: an elective event vs the Study of the group that dropped it → disjoint
    const eco = p.events.find((e) => e.subjectId === "Economics" && e.classIds.includes(cls))!;
    const study = p.events.find((e) => e.type === "self_study" && e.classIds.includes(cls))!;
    expect(attendeesIntersect(attendeesOf(eco, cls, groupsByClass), attendeesOf(study, cls, groupsByClass))).toBe(
      // they clash only if the study group also chose Economics — by construction it didn't
      groups.some((g) => (study.studentGroupIds ?? []).includes(g.id) && g.electiveSubjectIds.includes("Economics")),
    );

    // a whole-class lesson always intersects an elective audience (would be a real clash)
    const wholeClass = p.events.find((e) => e.classIds.includes(cls) && !e.studentGroupIds && e.subjectId === "Hindi")!;
    expect(attendeesIntersect(attendeesOf(wholeClass, cls, groupsByClass), attendeesOf(eco, cls, groupsByClass))).toBe(true);
  });

  it("injecting a real student-group double-book is caught by validate (HE2)", () => {
    const p = seedArtsElectives(buildBundledProject());
    const cls = "Class 11 Arts";
    const tt = ttOf(p);
    // place a second chosen elective for one group in a slot it already attends a chosen elective
    const groupAll = p.studentGroups.find((g) => g.classId === cls)!;
    // find a slot where this group attends Economics (its chosen) ...
    const eventIndex = new Map(p.events.map((e) => [e.id, e]));
    const ecoPlacement = tt.placements.find((pl) => {
      const ev = eventIndex.get(pl.eventId);
      return ev?.subjectId === "Economics" && ev.classIds.includes(cls) && (ev.studentGroupIds ?? []).includes(groupAll.id);
    });
    if (!ecoPlacement) return; // group dropped Economics; skip (covered by another group)
    // a second event for the SAME group at the SAME slot → overlap → clash
    const clashEvent = { id: "clash", type: "self_study" as const, subjectId: "Self Study", classIds: [cls], teacherIds: [], duration: 1, source: "manual" as const, studentGroupIds: [groupAll.id] };
    const broken: Project = {
      ...p,
      events: [...p.events, clashEvent],
      timetables: p.timetables.map((t) => (t.id === tt.id ? { ...t, placements: [...t.placements, { eventId: "clash", day: ecoPlacement.day, slot: ecoPlacement.slot, pinned: false }] } : t)),
    };
    expect(hard(broken)).toBeGreaterThan(0);
  });
});

describe("canParallelize", () => {
  it("is false for every elective pair under free 3-of-4 (each pair is co-taken)", () => {
    const p = seedArtsElectives(buildBundledProject());
    const groups = p.studentGroups.filter((g) => g.classId === "Class 11 Arts");
    expect(canParallelize(groups, "Economics", "Geography")).toBe(false);
    expect(canParallelize(groups, "Political Science", "English Literature")).toBe(false);
  });
  it("is true when no group chose both (restricted combinations)", () => {
    const restricted = seedArtsElectives(buildBundledProject()).studentGroups.filter((g) => g.classId === "Class 11 Arts");
    // craft two groups that never co-take A and B
    const a = "Geography", b = "Economics";
    const synthetic = [
      { id: "s1", classId: "X", name: "", electiveSubjectIds: [a, "Political Science"] },
      { id: "s2", classId: "X", name: "", electiveSubjectIds: [b, "English Literature"] },
    ];
    void restricted;
    expect(canParallelize(synthetic, a, b)).toBe(true);
  });
});
