import { describe, expect, it } from "vitest";
import { buildBundledProject } from "../fixtures/bundled";
import { evaluateConstraints } from "./constraints";
import { suggestConstraints } from "./suggestConstraints";

const ttOf = (p: ReturnType<typeof buildBundledProject>) => p.timetables.find((t) => t.id === p.activeTimetableId)!;

describe("suggestConstraints — descriptive proposals from the real timetable", () => {
  it("proposes ≥5 patterns with no duplicate (template, target)", () => {
    const p = buildBundledProject();
    const sug = suggestConstraints(p, ttOf(p));
    expect(sug.length).toBeGreaterThanOrEqual(5);
    const keys = sug.map((c) => `${c.template}|${JSON.stringify(c.params)}`);
    expect(new Set(keys).size).toBe(keys.length); // no duplicates
  });

  it("every suggestion is already satisfied (adding it creates ZERO new violations)", () => {
    const p = buildBundledProject();
    const tt = ttOf(p);
    for (const s of suggestConstraints(p, tt)) {
      const withOne = { ...p, constraints: [s] };
      const vios = evaluateConstraints(withOne, ttOf(withOne)).filter((v) => v.constraintId === s.template);
      expect(vios, `suggestion ${s.template} ${JSON.stringify(s.params)} should be satisfied`).toEqual([]);
    }
  });
});
