import { describe, it, expect } from "vitest";
import { diagnose } from "./diagnose";
import { makeDemoProject } from "../store/projectStore";
import { buildProject, type BuildInput } from "../domain/projectBuilder";

const active = (p: ReturnType<typeof makeDemoProject>) =>
  p.timetables.find((t) => t.id === p.activeTimetableId)!;

describe("diagnose — structural feasibility (M9)", () => {
  it("the demo (real quotas) has no structural blocker", () => {
    const p = makeDemoProject();
    const report = diagnose(p, p.activeTimetableId!);
    expect(report.ok).toBe(true);
    expect(report.blockers).toEqual([]);
  });

  it("over-committed teacher → readable blocker naming the bottleneck (AC)", () => {
    // One teacher required for 40 periods/week (cap 36).
    const input: BuildInput = {
      schoolName: "Tight School",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      periods: 6,
      classes: [
        { name: "Class A", group: "middle" },
        { name: "Class B", group: "middle" },
      ],
      teachers: [{ name: "Asha", subjects: ["Maths"], maxPeriodsPerWeek: 36 }],
      quotas: [
        { className: "Class A", subject: "Maths", teacher: "Asha", periodsPerWeek: 20 },
        { className: "Class B", subject: "Maths", teacher: "Asha", periodsPerWeek: 20 },
      ],
    };
    const p = buildProject(input);
    const report = diagnose(p, p.activeTimetableId!);
    expect(report.ok).toBe(false);
    const b = report.blockers.find((x) => x.kind === "teacher-week");
    expect(b).toBeTruthy();
    expect(b!.entity).toBe("Asha");
    expect(b!.message).toMatch(/Asha is needed for 40 periods.*at most 36/);
    expect(b!.suggestion).toMatch(/Asha/);
  });

  it("over-subscribed class → blocker naming the class and the shortfall", () => {
    const input: BuildInput = {
      schoolName: "Packed",
      days: ["Mon", "Tue"], // only 12 slots/week
      periods: 6,
      classes: [{ name: "Class A", group: "middle" }],
      teachers: [
        { name: "T1", subjects: ["X"] },
        { name: "T2", subjects: ["Y"] },
      ],
      quotas: [
        { className: "Class A", subject: "X", teacher: "T1", periodsPerWeek: 10 },
        { className: "Class A", subject: "Y", teacher: "T2", periodsPerWeek: 10 },
      ],
    };
    const p = buildProject(input);
    const report = diagnose(p, p.activeTimetableId!);
    const b = report.blockers.find((x) => x.kind === "class-capacity");
    expect(b).toBeTruthy();
    expect(b!.message).toMatch(/Class A needs 20 periods.*only has 12/);
  });

  it("counts ELGA block periods toward demand", () => {
    const p = makeDemoProject();
    // Bindu teaches little besides ELGA; lower her weekly cap below her real load.
    const bindu = p.teachers.find((t) => t.id === "Bindu")!;
    bindu.maxPeriodsPerWeek = 4; // ELGA alone = 3 periods × 2 days = 6 > 4
    const report = diagnose(p, active(p).id);
    expect(report.blockers.some((b) => b.entity === "Bindu" && /needed for/.test(b.message))).toBe(true);
  });
});
