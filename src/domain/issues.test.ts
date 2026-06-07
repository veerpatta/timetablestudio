import { describe, expect, it } from "vitest";
import { buildBundledProject } from "../fixtures/bundled";
import { makeMiniSchool } from "../fixtures/synthetic";
import { buildIssues } from "./issues";
import type { Placement, Project, Timetable } from "./types";

const tt = (p: Project): Timetable => p.timetables.find((t) => t.id === p.activeTimetableId)!;
const place = (eventId: string, slot: number, pinned = false): Placement => ({ eventId, day: "Mon", slot, pinned });

describe("buildIssues — plain-language problems, real clashes only", () => {
  it("reports ZERO issues on the bundled timetable (joint/team overlaps are NOT clashes)", () => {
    const p = buildBundledProject();
    expect(buildIssues(p, tt(p))).toEqual([]);
  });

  it("turns an injected teacher double-booking into one readable, jumpable, fixable issue", () => {
    const p = makeMiniSchool();
    const table = p.timetables.find((t) => t.id === "tt")!;
    // Nidhika teaches Class 1 AND Class 2 Maths at the same slot — two different events.
    table.placements = [place("evt-maths-c1", 1), place("evt-maths-c2", 1)];
    const issues = buildIssues(p, table);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.title).toMatch(/double-booked/i);
    expect(issues[0]!.title).not.toMatch(/HE1|constraint/i); // plain language, no codes
    expect(issues[0]!.fixable).toBe(true);
    expect(issues[0]!.jump).not.toBeNull();
  });

  it("marks the issue not-fixable when the only conflicting placements are pinned", () => {
    const p = makeMiniSchool();
    const table = p.timetables.find((t) => t.id === "tt")!;
    table.placements = [place("evt-maths-c1", 1, true), place("evt-maths-c2", 1, true)];
    const issues = buildIssues(p, table);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.fixable).toBe(false);
  });
});
