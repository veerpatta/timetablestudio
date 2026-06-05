import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { buildRule } from "./ruleFields";
import { RulesPage } from "./RulesPage";
import { useProjectStore } from "../../store/projectStore";
import { makeRealVppsProject } from "../../fixtures/vppsReal";
import type { RuleSeverity, RuleTemplate } from "../../domain/types";

const meta = { id: "x", severity: "must" as RuleSeverity, weight: 3 };

// The seven implicit VPPS families, each expressible through the builder schema.
describe("all seven VPPS constraint families are expressible (M16 AC)", () => {
  const cases: { name: string; template: RuleTemplate; draft: Record<string, unknown> }[] = [
    { name: "P1 anchor (R4)", template: "R4", draft: { classId: "Class 1", teacherId: "Bindu" } },
    { name: "ELGA days (R7)", template: "R7", draft: { blockId: "elga", days: ["Mon", "Tue"], startPeriod: 3 } },
    { name: "double period (R6)", template: "R6", draft: { classId: "Class 12 Commerce", subjectId: "Accountancy", count: 5 } },
    { name: "heavy early (R1)", template: "R1", draft: { subjects: ["Maths"], classScope: [], periods: ["1", "2", "3"] } },
    { name: "light not P1 (R2)", template: "R2", draft: { subjects: ["CCS"], classScope: [], periods: ["1"] } },
    { name: "board protect (R9)", template: "R9", draft: { classId: "Class 10", coreSubjects: ["Maths"] } },
    { name: "subject spread (R10)", template: "R10", draft: { subjectId: "SST", classScope: ["Class 9"], minDays: 4 } },
    { name: "teacher caps (R12)", template: "R12", draft: { teacherId: "Hemlata", maxPerDay: 6, maxPerWeek: 30 } },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const result = buildRule(c.template, c.draft as never, meta);
      expect("rule" in result).toBe(true);
      if (!("rule" in result)) return;
      expect(result.rule.template).toBe(c.template);
      // entity-backed families carry the patch that makes the rule live.
      if (c.template === "R4") expect(result.entityUpdates[0]).toMatchObject({ type: "classTeacher", teacherId: "Bindu" });
      if (c.template === "R7") expect(result.entityUpdates[0]).toMatchObject({ type: "blockSchedule", fixedStartPeriod: 3 });
      if (c.template === "R9") expect(result.entityUpdates[0]).toMatchObject({ type: "boardClass", value: true });
    });
  }

  it("reports a readable error when a required blank is empty", () => {
    const r = buildRule("R2", { subjects: [], periods: [] } as never, meta);
    expect("error" in r && r.error).toMatch(/subject/i);
  });
});

describe("RulesPage detect → accept flow on the real timetable (M16)", () => {
  beforeEach(() => {
    useProjectStore.getState().setProject(makeRealVppsProject());
  });

  it("detects rules from the timetable and accepts them into the project", () => {
    render(<RulesPage />);
    expect(useProjectStore.getState().project!.rules).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /Detect from timetable/ }));
    // The detected ELGA-days rule shows as a sentence.
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/ELGA runs only on/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Accept all" }));
    expect(useProjectStore.getState().project!.rules.length).toBeGreaterThan(0);
  });

  it("applies the Indian K-12 defaults", () => {
    render(<RulesPage />);
    fireEvent.click(screen.getByRole("button", { name: /Indian K-12 defaults/ }));
    const rules = useProjectStore.getState().project!.rules;
    expect(rules.some((r) => r.template === "R13")).toBe(true);
  });
});
