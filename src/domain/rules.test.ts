import { describe, it, expect } from "vitest";
import { evaluateRule, ruleSentence } from "./rules";
import { validate } from "./validate";
import { scoreTimetable } from "../solver/score";
import { deriveMaps, occupiedPeriods } from "./derive";
import { movePlacement } from "./edit";
import { deserializeProject } from "../persistence/projectFile";
import type {
  Day,
  Id,
  Lesson,
  Placement,
  Project,
  Rule,
  SchoolClass,
  Subject,
  Teacher,
} from "./types";

// --- tiny builders ---------------------------------------------------------
const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Parts {
  classes?: SchoolClass[];
  teachers?: Teacher[];
  subjects?: Subject[];
  activities?: Lesson[] | Project["activities"];
  placements?: Placement[];
  rules?: Rule[];
  days?: Day[];
  periods?: number;
}

function mkProject(parts: Parts): Project {
  return {
    schemaVersion: 2,
    school: { name: "t" },
    teachers: parts.teachers ?? [],
    classes: parts.classes ?? [],
    subjects: parts.subjects ?? [],
    profiles: [
      {
        id: "pf",
        name: "pf",
        days: parts.days ?? DAYS,
        periods: Array.from({ length: parts.periods ?? 6 }, (_, i) => ({
          label: `P${i + 1}`,
          start: "",
          end: "",
        })),
      },
    ],
    activities: parts.activities ?? [],
    requirements: { curriculum: [], blocks: [] },
    rules: parts.rules ?? [],
    timetables: [{ id: "tt", name: "tt", profileId: "pf", placements: parts.placements ?? [] }],
    activeTimetableId: "tt",
  };
}
const tt = (p: Project) => p.timetables[0]!;
const cls = (id: Id, name: string, extra: Partial<SchoolClass> = {}): SchoolClass => ({
  id,
  name,
  group: "primary",
  ...extra,
});
const subj = (id: Id): Subject => ({ id, name: id });
const teacher = (id: Id): Teacher => ({
  id,
  name: id,
  subjects: [],
  maxPeriodsPerDay: 6,
  maxPeriodsPerWeek: 36,
  unavailable: [],
});
const lesson = (id: Id, classId: Id, subjectId: Id, teacherIds: Id[], duration?: number): Lesson => ({
  kind: "lesson",
  id,
  classId,
  subjectId,
  teacherIds,
  ...(duration ? { duration } : {}),
});
const place = (activityId: Id, day: Day, period: number, pinned = false): Placement => ({
  activityId,
  day,
  period,
  pinned,
});

/** Evaluate one rule against a freshly built project. */
function run(rule: Rule, parts: Parts) {
  const p = mkProject(parts);
  return evaluateRule(p, tt(p), rule);
}

// --- the AC: every template R1–R15 has a satisfied + violated case ----------
describe("rule templates R1–R15 (M15)", () => {
  it("R1 — subject only in certain periods", () => {
    const r: Rule = { id: "r", template: "R1", enabled: true, severity: "must", weight: 1, subjectIds: ["Maths"], classIds: ["c1"], periods: [1, 2, 3] };
    const parts = { subjects: [subj("Maths")], classes: [cls("c1", "Class 1")], activities: [lesson("m", "c1", "Maths", ["T"])] };
    expect(run(r, { ...parts, placements: [place("m", "Mon", 2)] })).toHaveLength(0);
    const v = run(r, { ...parts, placements: [place("m", "Mon", 4)] });
    expect(v[0]?.constraintId).toBe("R1");
    expect(v[0]?.message).toMatch(/Maths.*Class 1/);
  });

  it("R2 — subject never in a period", () => {
    const r: Rule = { id: "r", template: "R2", enabled: true, severity: "must", weight: 1, subjectIds: ["CCS"], classIds: ["c1"], periods: [1] };
    const parts = { subjects: [subj("CCS")], classes: [cls("c1", "Class 1")], activities: [lesson("x", "c1", "CCS", ["T"])] };
    expect(run(r, { ...parts, placements: [place("x", "Mon", 4)] })).toHaveLength(0);
    const v = run(r, { ...parts, placements: [place("x", "Mon", 1)] });
    expect(v[0]?.message).toMatch(/CCS/);
  });

  it("R3 — subject in the first half of the day", () => {
    const r: Rule = { id: "r", template: "R3", enabled: true, severity: "prefer", weight: 1, subjectIds: ["Science"], classIds: ["c1"], half: "first" };
    const parts = { subjects: [subj("Science")], classes: [cls("c1", "Class 1")], activities: [lesson("s", "c1", "Science", ["T"])] };
    expect(run(r, { ...parts, placements: [place("s", "Mon", 2)] })).toHaveLength(0);
    expect(run(r, { ...parts, placements: [place("s", "Mon", 5)] })[0]?.message).toMatch(/first half/);
  });

  it("R4 — class teacher takes period 1 daily", () => {
    const r: Rule = { id: "r", template: "R4", enabled: true, severity: "must", weight: 1, classId: "c1" };
    const parts = {
      days: ["Mon", "Tue"] as Day[],
      teachers: [teacher("Bindu"), teacher("Other")],
      subjects: [subj("Maths")],
      classes: [cls("c1", "Class 1", { classTeacherId: "Bindu" })],
      activities: [lesson("bm", "c1", "Maths", ["Bindu"]), lesson("om", "c1", "Maths", ["Other"])],
    };
    expect(run(r, { ...parts, placements: [place("bm", "Mon", 1), place("bm", "Tue", 1)] })).toHaveLength(0);
    const v = run(r, { ...parts, placements: [place("bm", "Mon", 1), place("om", "Tue", 1)] });
    expect(v[0]?.message).toMatch(/Bindu.*period 1 on Tue/);
  });

  it("R5 — subject same period every day", () => {
    const r: Rule = { id: "r", template: "R5", enabled: true, severity: "prefer", weight: 1, classId: "c1", subjectId: "Acc" };
    const parts = { days: ["Mon", "Tue"] as Day[], subjects: [subj("Acc")], classes: [cls("c1", "Class 1")], activities: [lesson("a", "c1", "Acc", ["T"])] };
    expect(run(r, { ...parts, placements: [place("a", "Mon", 1), place("a", "Tue", 1)] })).toHaveLength(0);
    expect(run(r, { ...parts, placements: [place("a", "Mon", 1), place("a", "Tue", 2)] })[0]?.message).toMatch(/Acc/);
  });

  it("R6 — subject as a double period n×/week", () => {
    const r: Rule = { id: "r", template: "R6", enabled: true, severity: "prefer", weight: 1, classId: "c1", subjectId: "Maths", count: 2 };
    const dbl = [lesson("md", "c1", "Maths", ["T"], 2)];
    const single = [lesson("ms", "c1", "Maths", ["T"])];
    const base = { days: ["Mon", "Tue"] as Day[], subjects: [subj("Maths")], classes: [cls("c1", "Class 1")] };
    expect(run(r, { ...base, activities: dbl, placements: [place("md", "Mon", 1), place("md", "Tue", 1)] })).toHaveLength(0);
    expect(run(r, { ...base, activities: single, placements: [place("ms", "Mon", 1)] })[0]?.message).toMatch(/double period/);
  });

  it("R7 — block runs only on its allowed days at its fixed start", () => {
    const elga = { kind: "block" as const, id: "elga", name: "ELGA", classIds: ["c1"], teacherIds: ["T"], length: 3, allowedDays: ["Mon", "Tue", "Wed", "Thu"] as Day[], fixedStartPeriod: 3 };
    const r: Rule = { id: "r", template: "R7", enabled: true, severity: "must", weight: 1, blockId: "elga" };
    const base = { classes: [cls("c1", "Class 1")], activities: [elga] };
    expect(run(r, { ...base, placements: [place("elga", "Mon", 3)] })).toHaveLength(0);
    expect(run(r, { ...base, placements: [place("elga", "Fri", 3)] })[0]?.message).toMatch(/ELGA.*Fri/);
    expect(run(r, { ...base, placements: [place("elga", "Mon", 2)] })[0]?.message).toMatch(/must start at period 3/);
  });

  it("R8 — teacher not available at given slots", () => {
    const r: Rule = { id: "r", template: "R8", enabled: true, severity: "must", weight: 1, teacherId: "Maya", slots: [{ day: "Mon", period: 6 }] };
    const parts = { teachers: [teacher("Maya")], subjects: [subj("CCS")], classes: [cls("c1", "Class 1")], activities: [lesson("x", "c1", "CCS", ["Maya"])] };
    expect(run(r, { ...parts, placements: [place("x", "Mon", 1)] })).toHaveLength(0);
    expect(run(r, { ...parts, placements: [place("x", "Mon", 6)] })[0]?.message).toMatch(/Maya.*unavailable/);
  });

  it("R9 — board class protects periods 1–3 for core subjects", () => {
    const r: Rule = { id: "r", template: "R9", enabled: true, severity: "prefer", weight: 1, classId: "c10", coreSubjectIds: ["Maths", "Science"] };
    const parts = { subjects: [subj("Maths"), subj("CCS")], classes: [cls("c10", "Class 10", { isBoardClass: true })], activities: [lesson("m", "c10", "Maths", ["T"]), lesson("c", "c10", "CCS", ["T"])] };
    expect(run(r, { ...parts, placements: [place("m", "Mon", 1)] })).toHaveLength(0);
    expect(run(r, { ...parts, placements: [place("c", "Mon", 2)] })[0]?.message).toMatch(/Class 10.*CCS/);
    // gated: a non-board class is never flagged
    const notBoard = { ...parts, classes: [cls("c10", "Class 10")] };
    expect(run(r, { ...notBoard, placements: [place("c", "Mon", 2)] })).toHaveLength(0);
  });

  it("R10 — subject spread across at least n days", () => {
    const r: Rule = { id: "r", template: "R10", enabled: true, severity: "prefer", weight: 1, subjectId: "SST", classIds: ["c1"], minDays: 3 };
    const parts = { subjects: [subj("SST")], classes: [cls("c1", "Class 1")], activities: [lesson("s", "c1", "SST", ["T"])] };
    expect(run(r, { ...parts, placements: [place("s", "Mon", 1), place("s", "Tue", 1), place("s", "Wed", 1)] })).toHaveLength(0);
    expect(run(r, { ...parts, placements: [place("s", "Mon", 1), place("s", "Tue", 1)] })[0]?.message).toMatch(/SST.*2 day/);
  });

  it("R11 — max periods/day of a subject for a class", () => {
    const r: Rule = { id: "r", template: "R11", enabled: true, severity: "must", weight: 1, subjectId: "Maths", classId: "c1", maxPerDay: 2 };
    const parts = { subjects: [subj("Maths")], classes: [cls("c1", "Class 1")], activities: [lesson("m", "c1", "Maths", ["T"])] };
    expect(run(r, { ...parts, placements: [place("m", "Mon", 1), place("m", "Mon", 2)] })).toHaveLength(0);
    expect(run(r, { ...parts, placements: [place("m", "Mon", 1), place("m", "Mon", 2), place("m", "Mon", 3)] })[0]?.message).toMatch(/3 periods of Maths on Mon/);
  });

  it("R12 — teacher daily and weekly caps", () => {
    const r: Rule = { id: "r", template: "R12", enabled: true, severity: "must", weight: 1, teacherId: "T", maxPerDay: 2, maxPerWeek: 5 };
    const parts = { teachers: [teacher("T")], subjects: [subj("Maths")], classes: [cls("c1", "Class 1")], activities: [lesson("m", "c1", "Maths", ["T"])] };
    expect(run(r, { ...parts, placements: [place("m", "Mon", 1), place("m", "Mon", 2)] })).toHaveLength(0);
    expect(run(r, { ...parts, placements: [place("m", "Mon", 1), place("m", "Mon", 2), place("m", "Mon", 3)] })[0]?.message).toMatch(/T teaches 3 periods on Mon/);
  });

  it("R13 — teachers' days kept compact (no gaps)", () => {
    const r: Rule = { id: "r", template: "R13", enabled: true, severity: "prefer", weight: 1 };
    const parts = { teachers: [teacher("T")], subjects: [subj("Maths")], classes: [cls("c1", "Class 1")], activities: [lesson("m", "c1", "Maths", ["T"])] };
    expect(run(r, { ...parts, placements: [place("m", "Mon", 1), place("m", "Mon", 2)] })).toHaveLength(0);
    expect(run(r, { ...parts, placements: [place("m", "Mon", 1), place("m", "Mon", 3)] })[0]?.message).toMatch(/idle gap on Mon/);
  });

  it("R14 — one subject before another on the same day", () => {
    const r: Rule = { id: "r", template: "R14", enabled: true, severity: "prefer", weight: 1, classId: "c1", beforeSubjectId: "Theory", afterSubjectId: "Practice" };
    const parts = { subjects: [subj("Theory"), subj("Practice")], classes: [cls("c1", "Class 1")], activities: [lesson("t", "c1", "Theory", ["T"]), lesson("p", "c1", "Practice", ["T"])] };
    expect(run(r, { ...parts, placements: [place("t", "Mon", 2), place("p", "Mon", 4)] })).toHaveLength(0);
    expect(run(r, { ...parts, placements: [place("p", "Mon", 2), place("t", "Mon", 4)] })[0]?.message).toMatch(/Theory.*before.*Practice/);
  });

  it("R15 — teacher max consecutive periods", () => {
    const r: Rule = { id: "r", template: "R15", enabled: true, severity: "prefer", weight: 1, teacherId: "T", maxConsecutive: 2 };
    const parts = { teachers: [teacher("T")], subjects: [subj("Maths")], classes: [cls("c1", "Class 1")], activities: [lesson("m", "c1", "Maths", ["T"])] };
    expect(run(r, { ...parts, placements: [place("m", "Mon", 1), place("m", "Mon", 2), place("m", "Mon", 4)] })).toHaveLength(0);
    expect(run(r, { ...parts, placements: [place("m", "Mon", 1), place("m", "Mon", 2), place("m", "Mon", 3)] })[0]?.message).toMatch(/3 periods in a row/);
  });
});

// --- duration-2 (double period) as one unit ---------------------------------
describe("duration-2 lessons (M15)", () => {
  const dbl = mkProject({
    classes: [cls("c1", "Class 1")],
    subjects: [subj("Maths")],
    activities: [lesson("md", "c1", "Maths", ["T"], 2)],
    placements: [place("md", "Mon", 3)],
  });

  it("occupies two consecutive periods", () => {
    expect(occupiedPeriods(dbl.activities[0]!, 3)).toEqual([3, 4]);
  });

  it("moves as ONE unit (one placement, both cells follow)", () => {
    const moved = movePlacement(tt(dbl).placements, { activityId: "md", day: "Mon", period: 3 }, "Mon", 5);
    expect(moved).toHaveLength(1);
    expect(moved[0]).toMatchObject({ day: "Mon", period: 5 });
    const p2: Project = { ...dbl, timetables: [{ ...tt(dbl), placements: moved }] };
    const cells = deriveMaps(p2, tt(p2)).classCells.get("c1")!;
    expect(cells.has("Mon#5")).toBe(true);
    expect(cells.has("Mon#6")).toBe(true);
    expect(cells.has("Mon#3")).toBe(false);
  });

  it("flags a double period that runs past the day end (H4)", () => {
    const off = mkProject({
      classes: [cls("c1", "Class 1")],
      subjects: [subj("Maths")],
      activities: [lesson("md", "c1", "Maths", ["T"], 2)],
      placements: [place("md", "Mon", 6)],
    });
    expect(validate(off, tt(off)).some((v) => v.constraintId === "H4")).toBe(true);
  });
});

// --- integration: must → hard, prefer → weighted soft -----------------------
describe("rules wire into validate() and scoreTimetable() (M15)", () => {
  const base: Parts = {
    subjects: [subj("CCS")],
    classes: [cls("c1", "Class 1")],
    activities: [lesson("ccs", "c1", "CCS", ["T"])],
    placements: [place("ccs", "Mon", 1)],
  };
  const r2 = (severity: "must" | "prefer", weight: number): Rule => ({
    id: "x",
    template: "R2",
    enabled: true,
    severity,
    weight,
    subjectIds: ["CCS"],
    classIds: ["c1"],
    periods: [1],
  });

  it("a must rule joins the hard count in validate()", () => {
    const p = mkProject({ ...base, rules: [r2("must", 3)] });
    expect(validate(p, tt(p)).some((v) => v.constraintId === "R2" && v.severity === "hard")).toBe(true);
  });

  it("a prefer rule adds weight × violations to the soft score", () => {
    const p = mkProject({ ...base, rules: [r2("prefer", 7)] });
    const sb = scoreTimetable(p, tt(p));
    expect(sb.hard).toBe(0);
    expect(sb.soft.some((v) => v.constraintId === "R2")).toBe(true);
    expect(sb.score).toBe(7);
  });

  it("a disabled rule is ignored", () => {
    const p = mkProject({ ...base, rules: [{ ...r2("must", 3), enabled: false }] });
    expect(validate(p, tt(p)).some((v) => v.constraintId === "R2")).toBe(false);
  });
});

// --- v1 → v2 migration ------------------------------------------------------
describe("schema migration (M15)", () => {
  it("loads a v1 project file and migrates it to v2 with empty rules", () => {
    const v1 = {
      schemaVersion: 1,
      school: { name: "x" },
      teachers: [],
      classes: [],
      subjects: [],
      profiles: [],
      activities: [],
      requirements: { curriculum: [], blocks: [] },
      timetables: [],
      activeTimetableId: null,
    };
    const migrated = deserializeProject(JSON.stringify(v1));
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.rules).toEqual([]);
  });
});

// --- sentence-first rendering ----------------------------------------------
describe("ruleSentence — every rule reads as a sentence (M15)", () => {
  it("renders R2 and R4 in plain language, reading the class-teacher field", () => {
    const p = mkProject({
      teachers: [teacher("Bindu")],
      subjects: [subj("CCS")],
      classes: [cls("c1", "Class 1", { classTeacherId: "Bindu" })],
    });
    expect(ruleSentence(p, { id: "r", template: "R2", enabled: true, severity: "must", weight: 1, subjectIds: ["CCS"], classIds: ["c1"], periods: [1] })).toBe("CCS is never in period 1 (Class 1)");
    expect(ruleSentence(p, { id: "r", template: "R4", enabled: true, severity: "must", weight: 1, classId: "c1" })).toBe("Bindu is class teacher of Class 1 and takes period 1 daily");
  });
});
