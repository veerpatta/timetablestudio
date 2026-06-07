import { describe, it } from "vitest";
import { buildBundledProject } from "../fixtures/bundled";
import { scoreTimetable, DEFAULT_WEIGHTS } from "../solver/score";
import { legalSwaps, applySwap } from "./scenario";
import { movePlacement } from "./edit";
import { validate } from "./validate";
import type { Day, Id, Violation } from "./types";

const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function weightOf(v: Violation, rules: { id: string; weight: number }[]): number {
  if (/^R\d+$/.test(v.constraintId)) {
    return rules.find((r) => r.id === v.slots[0] ? false : false) ? 0 : 3;
  }
  return DEFAULT_WEIGHTS[v.constraintId as keyof typeof DEFAULT_WEIGHTS] ?? 3;
}

describe("M20 probe", () => {
  it("dumps the bundled suggestion landscape", () => {
    const p = buildBundledProject();
    const tt = p.timetables.find((t) => t.id === p.activeTimetableId)!;
    const { soft, score } = scoreTimetable(p, tt);
    console.log("PROBE total soft violations:", soft.length, "soft score:", score);

    // type mix
    const byType = new Map<string, number>();
    for (const v of soft) byType.set(v.constraintId, (byType.get(v.constraintId) ?? 0) + 1);
    console.log("PROBE type mix:", JSON.stringify([...byType.entries()].sort((a, b) => b[1] - a[1])));

    // group by primary entity (teacher first, else class)
    const groups = new Map<string, { kind: string; id: Id; count: number; impact: number; types: Set<string> }>();
    for (const v of soft) {
      const s = v.slots[0];
      const owner = s?.teacherId ? { kind: "teacher", id: s.teacherId } : s?.classId ? { kind: "class", id: s.classId } : { kind: "?", id: "?" };
      const key = `${owner.kind}:${owner.id}`;
      const g = groups.get(key) ?? { kind: owner.kind, id: owner.id, count: 0, impact: 0, types: new Set() };
      g.count++;
      g.impact += weightOf(v, []);
      g.types.add(v.constraintId);
      groups.set(key, g);
    }
    const ranked = [...groups.values()].sort((a, b) => b.impact - a.impact);
    console.log("PROBE group count:", ranked.length);
    console.log("PROBE top-8 groups:");
    for (const g of ranked.slice(0, 8)) {
      console.log(`  ${g.kind} ${g.id}: count=${g.count} impact=${g.impact} types=${[...g.types].join(",")}`);
    }

    // How much S2 is an intentional adjacent double vs a real split-cluster?
    const idx2 = new Map(p.activities.map((a) => [a.id, a]));
    let adjacentDoubles = 0;
    let splitClusters = 0;
    for (const cls of p.classes) {
      for (const day of DAYS) {
        const cells = tt.placements
          .filter((pl) => { const a = idx2.get(pl.activityId); return a?.kind === "lesson" && a.classId === cls.id && pl.day === day; })
          .map((pl) => ({ period: pl.period, subj: (idx2.get(pl.activityId) as { subjectId: Id }).subjectId }))
          .sort((a, b) => a.period - b.period);
        const bySubj = new Map<Id, number[]>();
        for (const c of cells) { const arr = bySubj.get(c.subj) ?? []; arr.push(c.period); bySubj.set(c.subj, arr); }
        for (const ps of bySubj.values()) {
          for (let i = 1; i < ps.length; i++) (ps[i] === ps[i - 1]! + 1 ? () => adjacentDoubles++ : () => splitClusters++)();
        }
      }
    }
    console.log(`PROBE S2 breakdown: adjacentDoubles=${adjacentDoubles} splitClusters=${splitClusters}`);

    // fixability of top-6: any same-day swap among the entity's placements that lowers soft & adds 0 hard?
    const index = new Map(p.activities.map((a) => [a.id, a]));
    for (const g of ranked.slice(0, 6)) {
      const refs = tt.placements
        .filter((pl) => {
          const a = index.get(pl.activityId);
          if (!a || a.kind !== "lesson") return false;
          return g.kind === "teacher" ? a.teacherIds.includes(g.id) : a.classId === g.id;
        })
        .map((pl) => ({ activityId: pl.activityId, day: pl.day, period: pl.period }));
      const periods = p.profiles[0]!.periods.length;
      let best = 0;
      let bestKind = "none";
      const hardBefore = validate(p, tt).filter((v) => v.severity === "hard").length;
      for (const r of refs) {
        // swaps (exchanges)
        for (const sw of legalSwaps(p, tt, r)) {
          const swapped = { ...tt, placements: applySwap(tt.placements, sw.ref, sw.with) };
          const delta = scoreTimetable(p, swapped).score - score;
          if (delta < best) {
            best = delta;
            bestKind = sw.ref.day === sw.with.day ? "swap-same-day" : "swap-cross-day";
          }
        }
        // moves into empty slots (any day/period)
        for (const day of DAYS) {
          for (let period = 1; period <= periods; period++) {
            if (day === r.day && period === r.period) continue;
            const moved = { ...tt, placements: movePlacement(tt.placements, r, day, period) };
            const hardAfter = validate(p, moved).filter((v) => v.severity === "hard").length;
            if (hardAfter > hardBefore) continue;
            const delta = scoreTimetable(p, moved).score - score;
            if (delta < best) {
              best = delta;
              bestKind = day === r.day ? "move-same-day" : "move-cross-day";
            }
          }
        }
      }
      console.log(`  FIX ${g.kind} ${g.id}: bestDelta=${best} via ${bestKind}`);
    }
  });
});
