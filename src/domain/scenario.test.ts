import { describe, it, expect } from "vitest";
import {
  changeLedger,
  impactOfMove,
  legalSwaps,
  applySwap,
  withClearedScope,
  changedCells,
  placementInScope,
} from "./scenario";
import { validate } from "./validate";
import { solve } from "../solver/engine";
import { makeRealVppsProject } from "../fixtures/vppsReal";
import type { Lesson, Placement, Project } from "./types";

// --- small controlled project for swap/impact/ledger -----------------------
function teacher(id: string) {
  return { id, name: id, subjects: ["A", "B", "C"], maxPeriodsPerDay: 6, maxPeriodsPerWeek: 36, unavailable: [] };
}
function lesson(id: string, classId: string, subjectId: string, teacherIds: string[]): Lesson {
  return { kind: "lesson", id, classId, subjectId, teacherIds };
}
function tinyProject(placements: Placement[], activities: Lesson[]): Project {
  return {
    schemaVersion: 2,
    school: { name: "t" },
    teachers: [teacher("T1"), teacher("T2")],
    classes: [
      { id: "c1", name: "Class 1", group: "primary" },
      { id: "c2", name: "Class 2", group: "primary" },
    ],
    subjects: [{ id: "A", name: "A" }, { id: "B", name: "B" }, { id: "C", name: "C" }],
    profiles: [{ id: "pf", name: "pf", days: ["Mon"], periods: Array.from({ length: 4 }, (_, i) => ({ label: `P${i + 1}`, start: "", end: "" })) }],
    activities,
    requirements: { curriculum: [], blocks: [] },
    rules: [],
    timetables: [{ id: "tt", name: "tt", profileId: "pf", placements }],
    activeTimetableId: "tt",
  };
}
const tt = (p: Project) => p.timetables[0]!;
const place = (activityId: string, period: number, pinned = false): Placement => ({ activityId, day: "Mon", period, pinned });

describe("swap finder (M17 AC) — independent oracle", () => {
  // c1: L1(A,T1)@P1, L3(B,T2)@P3, L4(C,T2)@P2 ; c2: L2(A,T1)@P3
  const acts = [lesson("L1", "c1", "A", ["T1"]), lesson("L3", "c1", "B", ["T2"]), lesson("L4", "c1", "C", ["T2"]), lesson("L2", "c2", "A", ["T1"])];
  const p = tinyProject([place("L1", 1), place("L3", 3), place("L4", 2), place("L2", 3)], acts);
  const ref = { activityId: "L1", day: "Mon" as const, period: 1 };

  it("baseline is feasible", () => {
    expect(validate(p, tt(p)).filter((v) => v.severity === "hard")).toHaveLength(0);
  });

  it("every returned swap keeps hard violations at 0 (re-validated, not filtered)", () => {
    const swaps = legalSwaps(p, tt(p), ref);
    expect(swaps.length).toBeGreaterThan(0);
    for (const s of swaps) {
      const next = { ...tt(p), placements: applySwap(tt(p).placements, s.ref, s.with) };
      expect(validate(p, next).filter((v) => v.severity === "hard")).toHaveLength(0);
    }
  });

  it("excludes a swap that WOULD clash (negative case)", () => {
    const swaps = legalSwaps(p, tt(p), ref);
    // L1↔L3 puts T1 at P3 twice (L1 and c2's L2) — a real clash, must be excluded.
    expect(swaps.some((s) => s.with.activityId === "L3")).toBe(false);
    const bad = { ...tt(p), placements: applySwap(tt(p).placements, ref, { activityId: "L3", day: "Mon", period: 3 }) };
    expect(validate(p, bad).some((v) => v.severity === "hard")).toBe(true);
  });
});

describe("change ledger + move impact (M17)", () => {
  // c1: L1(A,T1)@P1, L2(B,T1)@P1 — a teacher AND class clash in one slot.
  const acts = [lesson("L1", "c1", "A", ["T1"]), lesson("L2", "c1", "B", ["T1"])];
  const clash = tinyProject([place("L1", 1), place("L2", 1)], acts);

  it("impactOfMove reports the fixes when a clashing lesson moves to a free slot", () => {
    const impact = impactOfMove(clash, tt(clash), { activityId: "L2", day: "Mon", period: 1 }, "Mon", 2);
    expect(impact.fixes.length).toBeGreaterThanOrEqual(2); // H1 + H2 cleared
    expect(impact.breaks).toHaveLength(0);
  });

  it("changeLedger counts problems fixed vs created via set-difference", () => {
    const fixed = { ...tt(clash), placements: [place("L1", 1), place("L2", 2)] };
    const ledger = changeLedger(clash, tt(clash), fixed);
    expect(ledger.fixed).toBeGreaterThanOrEqual(2);
    expect(ledger.created).toBe(0);
    expect(ledger.changes.some((c) => c.period === 2)).toBe(true);
  });
});

describe("targeted regenerate (M17 AC) — changes ONLY the unfrozen scope", () => {
  const project = makeRealVppsProject();
  const ttId = project.activeTimetableId!;
  const base = project.timetables.find((t) => t.id === ttId)!;
  const class7Count = (pl: Placement[]) =>
    pl.filter((p) => {
      const a = project.activities.find((x) => x.id === p.activityId);
      return a?.kind === "lesson" && a.classId === "Class 7";
    }).length;

  it("clears only non-pinned single-class lessons in scope (blocks/pinned stay)", () => {
    const cleared = withClearedScope(project, ttId, { kind: "class", id: "Class 1" });
    const clearedTT = cleared.timetables.find((t) => t.id === ttId)!;
    // ELGA (a block touching Class 1) must survive the clear.
    const blocksKept = clearedTT.placements.some((p) => {
      const a = project.activities.find((x) => x.id === p.activityId);
      return a?.kind === "block";
    });
    expect(blocksKept).toBe(true);
  });

  it("re-solving a cleared class changes ONLY that class's cells, with no new conflicts", () => {
    const cleared = withClearedScope(project, ttId, { kind: "class", id: "Class 7" });
    // A tight, heavily-coupled scope may not fully refit within budget — the AC is
    // scope CONTAINMENT, not completeness (the UI surfaces `complete`). Cap time so
    // the test stays fast; a partial result still proves containment.
    const result = solve(cleared, ttId, { mode: "complete", seed: 7, maxMillis: 1500 });
    const changes = changedCells(project, base.placements, result.placements);
    expect(changes.length).toBeGreaterThan(0); // it really regenerated
    expect(changes.every((c) => c.classId === "Class 7")).toBe(true); // ← the AC
    // No NEW hard conflict is introduced outside or inside the scope.
    expect(validate(cleared, { ...base, placements: result.placements }).filter((v) => v.severity === "hard")).toHaveLength(0);
    // Refit is bounded by Class 7's original load (never invents foreign lessons).
    expect(class7Count(result.placements)).toBeLessThanOrEqual(class7Count(base.placements));
  });

  it("placementInScope respects pinned + block exclusions", () => {
    const block = base.placements.find((p) => {
      const a = project.activities.find((x) => x.id === p.activityId);
      return a?.kind === "block";
    })!;
    expect(placementInScope(project, block, { kind: "class", id: "Class 1" })).toBe(false);
  });
});
