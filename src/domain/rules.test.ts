import { describe, expect, it } from "vitest";
import { makeMiniSchool } from "../fixtures/synthetic";
import { evaluateRules } from "./rules";
import type { Placement, Project, Rule } from "./types";

/** makeMiniSchool + extra subjects/teachers/events so every rule has something to bite. */
function ruleBase(): Project {
  const p = makeMiniSchool();
  p.subjects.push({ id: "EVS", name: "EVS", bands: ["primary"], kind: "academic" });
  p.subjects.push({ id: "Sci", name: "Science", bands: ["primary"], kind: "academic" });
  p.teachers.push({ id: "evsT", name: "Eva", maxPerDay: 8, maxPerWeek: 48, schedulable: true, unavailable: [] });
  p.qualifications.push({ teacherId: "evsT", subjectId: "EVS", classId: "c1" });
  p.qualifications.push({ teacherId: "mMaths", subjectId: "Sci", classId: "c1" });
  p.events.push({ id: "evt-evs-c1", type: "normal", subjectId: "EVS", classIds: ["c1"], teacherIds: ["evsT"], duration: 1, source: "manual" });
  p.events.push({ id: "evt-sci-c1", type: "normal", subjectId: "Sci", classIds: ["c1"], teacherIds: ["mMaths"], duration: 1, source: "manual" });
  p.events.push({ id: "evt-maths2-c1", type: "normal", subjectId: "Maths", classIds: ["c1"], teacherIds: ["mMaths"], duration: 2, source: "manual" });
  return p;
}

let counter = 0;
const R = (r: Partial<Rule> & { template: Rule["template"] }): Rule =>
  ({ id: `r${counter++}`, enabled: true, severity: "must", weight: 1, ...r }) as Rule;
const pl = (eventId: string, day: Placement["day"], slot: number): Placement => ({ eventId, day, slot, pinned: false });
const setP = (p: Project, placements: Placement[]) => { p.timetables.find((t) => t.id === "tt")!.placements = placements; };
const evalR = (p: Project) => evaluateRules(p, p.timetables.find((t) => t.id === "tt")!);

/** Run a satisfied case (expect 0) and a violated case (expect ≥1, plain message, right id). */
function check(rule: Rule, satisfied: Placement[], violated: Placement[], extra?: (p: Project) => void): void {
  const ok = ruleBase();
  extra?.(ok);
  ok.rules = [rule];
  setP(ok, satisfied);
  expect(evalR(ok)).toHaveLength(0);

  const bad = ruleBase();
  extra?.(bad);
  bad.rules = [rule];
  setP(bad, violated);
  const v = evalR(bad);
  expect(v.length).toBeGreaterThan(0);
  expect(v[0]!.constraintId).toBe(rule.template);
  expect(v[0]!.message).not.toMatch(/\b(R\d|HE\d|constraintId)\b/); // plain language, no codes
}

describe("evaluateRules — each template has a satisfied and a violated case", () => {
  it("R1 subject only in given slots", () =>
    check(R({ template: "R1", subjectIds: ["Maths"], classIds: ["c1"], slots: [1, 2] }), [pl("evt-maths-c1", "Mon", 1)], [pl("evt-maths-c1", "Mon", 3)]));

  it("R2 subject never in given slots", () =>
    check(R({ template: "R2", subjectIds: ["Maths"], classIds: ["c1"], slots: [3] }), [pl("evt-maths-c1", "Mon", 1)], [pl("evt-maths-c1", "Mon", 3)]));

  it("R3 subject in the first half", () =>
    check(R({ template: "R3", subjectIds: ["Maths"], classIds: ["c1"], half: "first" }), [pl("evt-maths-c1", "Mon", 2)], [pl("evt-maths-c1", "Mon", 7)]));

  it("R4 class teacher takes period 1 daily", () => {
    const setCT = (p: Project) => { p.classes.find((c) => c.id === "c1")!.classTeacherId = "mMaths"; };
    const allDays: Placement[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => pl("evt-maths-c1", d as Placement["day"], 1));
    check(R({ template: "R4", classId: "c1" }), allDays, [pl("evt-evs-c1", "Mon", 1)], setCT);
  });

  it("R5 subject at the same period every day", () =>
    check(R({ template: "R5", classId: "c1", subjectId: "Maths" }), [pl("evt-maths-c1", "Mon", 1), pl("evt-maths-c1", "Tue", 1)], [pl("evt-maths-c1", "Mon", 1), pl("evt-maths-c1", "Tue", 2)]));

  it("R6 double period N×/week", () =>
    check(R({ template: "R6", classId: "c1", subjectId: "Maths", count: 1 }), [pl("evt-maths2-c1", "Mon", 1)], [pl("evt-maths-c1", "Mon", 1)]));

  it("R7 block runs at a consistent time", () =>
    check(R({ template: "R7", eventId: "evt-elga" }), [pl("evt-elga", "Mon", 3), pl("evt-elga", "Tue", 3)], [pl("evt-elga", "Mon", 3), pl("evt-elga", "Tue", 4)]));

  it("R8 teacher not available at given slots", () =>
    check(R({ template: "R8", teacherId: "mMaths", slots: [{ day: "Mon", slot: 1 }] }), [pl("evt-maths-c1", "Tue", 1)], [pl("evt-maths-c1", "Mon", 1)]));

  it("R9 board class — core subjects in first three periods", () =>
    check(R({ template: "R9", classId: "c1", coreSubjectIds: ["Maths"] }), [pl("evt-maths-c1", "Mon", 1)], [pl("evt-evs-c1", "Mon", 1)]));

  it("R10 subject spread across ≥ N days", () =>
    check(R({ template: "R10", subjectId: "Maths", classIds: ["c1"], minDays: 3 }), [pl("evt-maths-c1", "Mon", 1), pl("evt-maths-c1", "Tue", 1), pl("evt-maths-c1", "Wed", 1)], [pl("evt-maths-c1", "Mon", 1), pl("evt-maths-c1", "Tue", 1)]));

  it("R11 max N/day of a subject", () =>
    check(R({ template: "R11", subjectId: "Maths", classId: "c1", maxPerDay: 1 }), [pl("evt-maths-c1", "Mon", 1)], [pl("evt-maths-c1", "Mon", 1), pl("evt-maths-c1", "Mon", 2)]));

  it("R12 teacher daily/weekly caps", () =>
    check(R({ template: "R12", teacherId: "mMaths", maxPerDay: 1, maxPerWeek: 10 }), [pl("evt-maths-c1", "Mon", 1)], [pl("evt-maths-c1", "Mon", 1), pl("evt-maths-c1", "Mon", 2)]));

  it("R13 compact teacher days (prefer → soft)", () => {
    const rule = R({ template: "R13", severity: "prefer" });
    check(rule, [pl("evt-maths-c1", "Mon", 1), pl("evt-sci-c1", "Mon", 2)], [pl("evt-maths-c1", "Mon", 1), pl("evt-sci-c1", "Mon", 4)]);
    const bad = ruleBase();
    bad.rules = [rule];
    setP(bad, [pl("evt-maths-c1", "Mon", 1), pl("evt-sci-c1", "Mon", 4)]);
    expect(evalR(bad)[0]!.severity).toBe("soft");
  });

  it("R14 subject A before subject B on the same day", () =>
    check(R({ template: "R14", classId: "c1", beforeSubjectId: "Sci", afterSubjectId: "EVS" }), [pl("evt-sci-c1", "Mon", 1), pl("evt-evs-c1", "Mon", 2)], [pl("evt-evs-c1", "Mon", 1), pl("evt-sci-c1", "Mon", 2)]));

  it("R15 teacher max consecutive periods", () =>
    check(R({ template: "R15", teacherId: "mMaths", maxConsecutive: 1 }), [pl("evt-maths-c1", "Mon", 1), pl("evt-sci-c1", "Mon", 3)], [pl("evt-maths-c1", "Mon", 1), pl("evt-sci-c1", "Mon", 2)]));
});
