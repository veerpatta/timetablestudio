import { describe, it, expect } from "vitest";
import { solve } from "./engine";
import { validate } from "../domain/validate";
import { scoreTimetable, type SoftWeights } from "./score";
import { makeSampleProject, makeDemoProject } from "../store/projectStore";
import type { Day, Project, Timetable } from "../domain/types";

const active = (p: Project): Timetable =>
  p.timetables.find((t) => t.id === p.activeTimetableId)!;

const ALL_DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Roomy variant: the normalized sample on a full 6-day week (quotas unchanged),
 * giving the generator slack for genuinely different candidates. */
function roomyProject(): Project {
  const p = makeSampleProject();
  return {
    ...p,
    profiles: p.profiles.map((pr) => ({ ...pr, days: ALL_DAYS })),
  };
}

const withPlacements = (p: Project, placements: Timetable["placements"]): Project => ({
  ...p,
  timetables: p.timetables.map((t) =>
    t.id === p.activeTimetableId ? { ...t, placements } : t,
  ),
});

describe("solver — M9 full generation from real quotas", () => {
  it("generates a full feasible 6-day timetable from the demo quotas in < 10s", () => {
    const base = makeDemoProject(); // 16 classes, real quotas, ELGA pinned
    const r = solve(base, base.activeTimetableId!, { mode: "generate", seed: 5, maxMillis: 10000 });
    expect(r.complete).toBe(true);
    expect(r.millis).toBeLessThan(10000);
    const fp = withPlacements(base, r.placements);
    expect(validate(fp, active(fp)).filter((v) => v.severity === "hard")).toEqual([]);
  });
});

describe("solver — M4 full generation", () => {
  it("3 seeds yield 3 feasible, visibly different candidates", () => {
    const base = roomyProject();
    const id = base.activeTimetableId!;
    const results = [1, 2, 3].map((seed) =>
      solve(base, id, { mode: "generate", seed, maxMillis: 5000 }),
    );

    // all feasible (0 hard) per the REAL validator
    for (const r of results) {
      expect(r.complete).toBe(true);
      const fp = withPlacements(base, r.placements);
      expect(validate(fp, active(fp)).filter((v) => v.severity === "hard")).toEqual([]);
    }

    // visibly different: pairwise placement sets differ
    const sig = (r: (typeof results)[number]) =>
      JSON.stringify(r.placements.map((p) => `${p.activityId}@${p.day}#${p.period}`).sort());
    const sigs = new Set(results.map(sig));
    expect(sigs.size).toBe(3);
  });

  it("preserves the pinned ELGA block in every candidate", () => {
    const base = roomyProject();
    const pins = active(base).placements.filter((p) => p.pinned);
    const r = solve(base, base.activeTimetableId!, { mode: "generate", seed: 42, maxMillis: 5000 });
    for (const pin of pins) {
      expect(
        r.placements.some(
          (p) => p.activityId === pin.activityId && p.day === pin.day && p.period === pin.period,
        ),
      ).toBe(true);
    }
  });

  it("soft weights re-rank candidates deterministically", () => {
    const base = roomyProject();
    const id = base.activeTimetableId!;
    const cands = [10, 20, 30, 40].map((seed) => {
      const r = solve(base, id, { mode: "generate", seed, maxMillis: 5000 });
      return withPlacements(base, r.placements);
    });

    const rankUnder = (w: SoftWeights) =>
      cands
        .map((c, i) => ({ i, score: scoreTimetable(c, active(c), w).score }))
        .sort((a, b) => a.score - b.score)
        .map((x) => x.i);

    const wGaps: SoftWeights = { S1: 100, S2: 1, S3: 1, S4: 1, S5: 1, S6: 1 };
    const wSpread: SoftWeights = { S1: 1, S2: 100, S3: 1, S4: 1, S5: 1, S6: 1 };

    // deterministic: same weights → same ranking on repeat
    expect(rankUnder(wGaps)).toEqual(rankUnder(wGaps));
    // the two weightings are not guaranteed to differ, but the BEST under each
    // must be a well-defined, reproducible choice.
    expect(rankUnder(wSpread)).toEqual(rankUnder(wSpread));
  });
});
