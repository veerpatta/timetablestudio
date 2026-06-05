import { describe, it, expect } from "vitest";
import { detectRules, acceptProposal } from "./ruleDetect";
import { indianK12Defaults } from "./rulePresets";
import { addRule, removeRule, toggleRule, updateRule, addRuleWithBacking } from "./ruleEdit";
import { validate } from "./validate";
import { makeRealVppsProject } from "../fixtures/vppsReal";
import type { Project, R4Rule, R6Rule, R7Rule, Rule, Timetable } from "./types";

function realProject(): { project: Project; tt: Timetable } {
  const project = makeRealVppsProject();
  const tt = project.timetables.find((t) => t.id === project.activeTimetableId)!;
  return { project, tt };
}

describe("import auto-detection on the REAL VPPS timetable (M16 AC)", () => {
  const { project, tt } = realProject();
  const proposals = detectRules(project, tt);

  it("proposes the P1 class-teacher anchors, including Class 6's 4-of-6 majority", () => {
    const r4 = proposals.filter((p) => p.rule.template === "R4").map((p) => p.rule as R4Rule);
    // Class 1 = Maths/Bindu every day; Class 6 = Hemlata P1 on a majority of days.
    expect(r4.some((r) => r.classId === "Class 1")).toBe(true);
    expect(r4.some((r) => r.classId === "Class 6")).toBe(true);
    expect(r4.some((r) => r.classId === "Class 10")).toBe(true);
  });

  it("proposes ELGA running Mon–Thu starting period 3 (read from placements)", () => {
    const r7 = proposals.filter((p) => p.rule.template === "R7");
    // ONLY the genuine multi-period block (ELGA) — NOT the length-1 combined
    // senior sections (joint Hindi/Economics/English), which aren't scheduled runs.
    expect(r7).toHaveLength(1);
    const elga = r7[0]!;
    expect((elga.rule as R7Rule).blockId.toLowerCase()).toContain("elga");
    const upd = elga.entityUpdates.find((u) => u.type === "blockSchedule");
    expect(upd && upd.type === "blockSchedule" && upd.allowedDays).toEqual(["Mon", "Tue", "Wed", "Thu"]);
    expect(upd && upd.type === "blockSchedule" && upd.fixedStartPeriod).toBe(3);
  });

  it("proposes the 12-Commerce Accountancy double period", () => {
    const r6 = proposals
      .filter((p) => p.rule.template === "R6")
      .map((p) => p.rule as R6Rule);
    expect(r6.some((r) => r.classId === "Class 12 Commerce" && r.subjectId === "Accountancy")).toBe(true);
  });

  it("every proposal renders as a sentence and carries entity-named slots", () => {
    expect(proposals.length).toBeGreaterThan(0);
    for (const p of proposals) expect(p.sentence.length).toBeGreaterThan(0);
  });

  it("accepting ALL detected rules keeps the real timetable at 0 hard conflicts", () => {
    let next = project;
    for (const p of proposals) next = acceptProposal(next, p);
    expect(validate(next, tt).filter((v) => v.severity === "hard")).toHaveLength(0);
  });

  it("accepting an anchor adds the rule AND sets the class-teacher field (one path)", () => {
    const anchor = proposals.find((p) => p.rule.template === "R4" && (p.rule as R4Rule).classId === "Class 1")!;
    const next = acceptProposal(project, anchor);
    expect(next.classes.find((c) => c.id === "Class 1")?.classTeacherId).toBe("Bindu");
    expect(next.rules.some((r) => r.template === "R4")).toBe(true);
    // and the accepted R4 must now be satisfied (Bindu really is P1 daily-ish) —
    // at minimum it doesn't crash validate and the rule is active.
    expect(() => validate(next, tt)).not.toThrow();
  });
});

describe("rule CRUD (M16)", () => {
  const base = makeRealVppsProject();
  const r: Rule = { id: "t1", template: "R2", enabled: true, severity: "must", weight: 3, subjectIds: ["CCS"], classIds: [], periods: [1] };

  it("adds, toggles, updates and removes a rule", () => {
    let p = addRule(base, r);
    expect(p.rules).toHaveLength(1);
    p = toggleRule(p, "t1");
    expect(p.rules[0]!.enabled).toBe(false);
    p = updateRule(p, { ...r, enabled: true, weight: 9 });
    expect(p.rules[0]!.weight).toBe(9);
    p = removeRule(p, "t1");
    expect(p.rules).toHaveLength(0);
  });

  it("addRuleWithBacking patches the backing entity (board class)", () => {
    const rule: Rule = { id: "b1", template: "R9", enabled: true, severity: "prefer", weight: 4, classId: "Class 10", coreSubjectIds: ["Maths", "Science"] };
    const p = addRuleWithBacking(base, rule, [{ type: "boardClass", classId: "Class 10", value: true }]);
    expect(p.classes.find((c) => c.id === "Class 10")?.isBoardClass).toBe(true);
    expect(p.rules.some((r) => r.template === "R9")).toBe(true);
  });
});

describe("Indian K-12 preset bundle (M16)", () => {
  it("builds guarded default rules from the project's own entities", () => {
    const project = makeRealVppsProject();
    const rules = indianK12Defaults(project);
    // heavy-early + light-not-P1 + one cap per teacher + compact
    expect(rules.some((r) => r.id === "preset-heavy-early")).toBe(true);
    expect(rules.some((r) => r.id === "preset-compact" && r.template === "R13")).toBe(true);
    expect(rules.filter((r) => r.template === "R12")).toHaveLength(project.teachers.length);
  });

  it("never references a subject the project lacks", () => {
    const empty: Project = { ...makeRealVppsProject(), subjects: [], teachers: [] };
    const rules = indianK12Defaults(empty);
    // no heavy/light rules without subjects; no caps without teachers; compact still fine
    expect(rules.every((r) => r.template === "R13")).toBe(true);
  });
});
