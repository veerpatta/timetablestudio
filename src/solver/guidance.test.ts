import { describe, it, expect } from "vitest";
import { nextStep, preflight } from "./guidance";
import { buildProject, type BuildInput } from "../domain/projectBuilder";
import { fillSubjectColumn, setClassSubjectQuota } from "../domain/projectEdit";
import type { Project } from "../domain/types";

function baseSchool(): Project {
  const input: BuildInput = {
    schoolName: "T",
    days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], // 36 slots/class
    periods: 6,
    classes: [
      { name: "Class 6", group: "middle" },
      { name: "Class 7", group: "middle" },
    ],
    teachers: [{ name: "Nidhika", subjects: ["Maths"] }],
    quotas: [],
  };
  return buildProject(input);
}

describe("guidance (M14)", () => {
  it("nextStep: empty quotas → add quotas", () => {
    const p = baseSchool();
    expect(nextStep(p, p.activeTimetableId!, 0)?.view).toBe("quotas");
    expect(nextStep(p, p.activeTimetableId!, 0)?.message).toMatch(/Add weekly subject quotas/);
  });

  it("nextStep: a clean but under-quota project names the class and the missing count", () => {
    let p = baseSchool();
    // Give both classes a small quota: 4 periods of 36 → 32 unplanned each.
    p = fillSubjectColumn(p, "Maths", "Nidhika", 4, ["Class 6", "Class 7"]);
    const step = nextStep(p, p.activeTimetableId!, 0)!;
    expect(step.view).toBe("quotas");
    expect(step.message).toMatch(/Class \d has 32 unplanned periods/);
  });

  it("nextStep: conflicts take priority over everything", () => {
    const p = baseSchool();
    expect(nextStep(p, p.activeTimetableId!, 2)?.message).toMatch(/2 clashes to fix/);
  });

  it("preflight: under-quota is a WARNING, not a blocker (generation may proceed)", () => {
    let p = baseSchool();
    p = fillSubjectColumn(p, "Maths", "Nidhika", 4, ["Class 6", "Class 7"]);
    const pre = preflight(p, p.activeTimetableId!);
    expect(pre.ok).toBe(true); // warnings don't block
    expect(pre.items.some((i) => i.status === "warn" && /unplanned/.test(i.label))).toBe(true);
  });

  it("preflight: no quotas blocks; over-capacity blocks", () => {
    const empty = baseSchool();
    expect(preflight(empty, empty.activeTimetableId!).ok).toBe(false);

    // Over-book a class: 40 periods into a 36-slot week.
    let p = baseSchool();
    p = setClassSubjectQuota(p, "Class 6", "Maths", { teacher: "Nidhika", periodsPerWeek: 40 });
    const pre = preflight(p, p.activeTimetableId!);
    expect(pre.ok).toBe(false);
    expect(pre.items.some((i) => i.status === "blocker")).toBe(true);
  });
});
