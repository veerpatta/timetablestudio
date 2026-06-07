// C6 part 2/2 — the generator OPTIMISES prefers via best-of-N. Every seed is already legal
// (fill pre-respects hard musts), so generate() must (a) stay legal, (b) be deterministic,
// and (c) actually return the lowest-soft fill among the seeds it tried — not just seed 1.

import { describe, expect, it } from "vitest";
import { validate } from "../domain/validate";
import { buildBundledProject } from "../fixtures/bundled";
import type { Constraint, Placement, Project } from "../domain/types";
import { fill } from "./fill";
import { generate } from "./generate";

const ttId = (p: Project) => p.activeTimetableId!;
const tableOf = (p: Project) => p.timetables.find((t) => t.id === ttId(p))!;
const softOf = (p: Project) => validate(p, tableOf(p)).filter((v) => v.severity === "soft").length;
const hardOf = (p: Project) => validate(p, tableOf(p)).filter((v) => v.severity === "hard").length;

/** Clear ~30% of non-pinned whole-class normals so the seeds have room to differ. */
function clear30(base: Project): Project {
  const ids = new Set(base.events.filter((e) => e.type === "normal" && !e.studentGroupIds).map((e) => e.id));
  const movable = tableOf(base).placements.filter((p) => !p.pinned && ids.has(p.eventId));
  const drop = new Set<Placement>(movable.filter((_, i) => i % 10 < 3));
  return {
    ...base,
    timetables: base.timetables.map((t) => (t.id === ttId(base) ? { ...t, placements: t.placements.filter((p) => !drop.has(p)) } : t)),
  };
}

describe("C6 generate — best-of-N prefers, legal and deterministic", () => {
  // a prefer constraint whose soft count varies by arrangement (gaps differ per seed)
  const compact = (teacherId: string): Constraint =>
    ({ id: "pref:compact", scope: "teacher", severity: "prefer", weight: 1, enabled: true, template: "teacher_compact_day", params: { teacherId } } as Constraint);

  it("returns a legal fill (0 hard) and reports the seeds it compared", () => {
    const base = buildBundledProject();
    const teacher = base.teachers.find((t) => t.schedulable)!.id;
    const cleared = { ...clear30(base), constraints: [...base.constraints, compact(teacher)] };
    const g = generate(cleared, ttId(base), { seeds: 6 });
    expect(hardOf(g.project)).toBe(0);
    expect(g.triedSeeds).toBe(6);
    expect(g.seed).toBeGreaterThanOrEqual(1);
  });

  it("picks the lowest-soft seed (not merely seed 1)", () => {
    const base = buildBundledProject();
    const teacher = base.teachers.find((t) => t.schedulable)!.id;
    const cleared = { ...clear30(base), constraints: [...base.constraints, compact(teacher)] };

    const N = 8;
    const perSeed = Array.from({ length: N }, (_, i) => softOf(fill(cleared, ttId(base), { seed: i + 1 }).project));
    const best = Math.min(...perSeed);

    const g = generate(cleared, ttId(base), { seeds: N });
    expect(g.softScore).toBe(best); // chose the minimum, not just seed 1
    expect(g.softScore).toBeLessThanOrEqual(perSeed[0]!);
  });

  it("is deterministic (same seed list → identical result)", () => {
    const base = buildBundledProject();
    const cleared = clear30(base);
    const a = generate(cleared, ttId(base), { seeds: 5 });
    const b = generate(cleared, ttId(base), { seeds: 5 });
    expect(b.seed).toBe(a.seed);
    expect(b.softScore).toBe(a.softScore);
    expect(tableOf(b.project).placements).toEqual(tableOf(a.project).placements);
    expect(b.added).toEqual(a.added);
  });
});
