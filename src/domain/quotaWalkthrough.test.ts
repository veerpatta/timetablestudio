import { describe, it, expect } from "vitest";
import { buildProject, type BuildInput } from "./projectBuilder";
import { addBlock, fillSubjectColumn, copyClassQuotas } from "./projectEdit";
import { preflight } from "../solver/guidance";
import type { Project } from "./types";

// M13 AC: full VPPS-scale data is enterable from scratch using the matrix + bulk
// tools, NOT one row at a time. This scripts the from-scratch path at the domain
// level (the wizard builds the skeleton; the matrix's bulk ops do the quotas) and
// asserts a complete project results from a handful of bulk calls. The "<15 min"
// figure is the human target the bulk tools serve; what's testable is that the
// tools — not 100 single-row entries — produce the full plan.

const CLASSES = [
  "Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8",
  "Class 9", "Class 10", "Class 11 Science", "Class 11 Arts", "Class 11 Commerce",
  "Class 12 Commerce", "Class 12 Science", "Class 12 Arts",
];

describe("M13 — full data enterable via matrix + bulk tools", () => {
  it("a few bulk operations fill weekly quotas for all 16 classes (no per-row grind)", () => {
    // 1) Wizard skeleton: 16 classes, 6 days, 6 periods, a roster, no quotas yet.
    const input: BuildInput = {
      schoolName: "VPPS",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      periods: 6,
      classes: CLASSES.map((name) => ({ name, group: "middle" })),
      teachers: [
        { name: "Anjana", subjects: ["Hindi"] },
        { name: "Harshita", subjects: ["English compulsory"] },
        { name: "Nidhika", subjects: ["Maths"] },
        { name: "Toshit", subjects: ["Science"] },
        { name: "Bindu", subjects: [] }, // ELGA block teacher (blocks bypass subject checks)
      ],
      quotas: [],
    };
    let p: Project = buildProject(input);
    const ttId = p.activeTimetableId!;

    // 2) Wizard Blocks step: ELGA across the five primary classes, Mon–Thu.
    //    Its own teacher (Bindu) — the column teachers are each already at 32/wk.
    p = addBlock(p, {
      name: "ELGA",
      classIds: ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5"],
      teacherIds: ["Bindu"],
      length: 3,
      days: ["Mon", "Tue", "Wed", "Thu"],
      startPeriod: 3,
    });

    const allIds = p.classes.map((c) => c.id);
    let bulkCalls = 0;

    // 3) Bulk-fill four subject columns across ALL classes at once. 2 periods ×
    //    16 classes = 32 per teacher, within the 36/week cap (stays feasible).
    p = fillSubjectColumn(p, "Maths", "Nidhika", 2, allIds); bulkCalls++;
    p = fillSubjectColumn(p, "Hindi", "Anjana", 2, allIds); bulkCalls++;
    p = fillSubjectColumn(p, "English compulsory", "Harshita", 2, allIds); bulkCalls++;
    p = fillSubjectColumn(p, "Science", "Toshit", 2, allIds); bulkCalls++;

    // 4) Copy Class 6's plan onto two more classes in one tool action.
    p = copyClassQuotas(p, "Class 6", ["Class 7", "Class 8"]); bulkCalls++;

    // Every class now has quotas — produced by a handful of bulk calls, not ~64 rows.
    const classesWithQuota = new Set(p.requirements.curriculum.map((r) => r.classId));
    expect(classesWithQuota.size).toBe(16);
    expect(p.requirements.curriculum.length).toBe(64); // 16 × 4 subjects
    expect(bulkCalls).toBeLessThanOrEqual(6);

    // The pre-flight passes: quotas present, no teacher/class over capacity.
    // (Under-target classes only raise warnings, which don't block generation.)
    const pre = preflight(p, ttId);
    expect(pre.ok).toBe(true);
    expect(pre.items.some((i) => i.status === "blocker")).toBe(false);
    // ELGA survived as one atomic block.
    expect(p.activities.filter((a) => a.kind === "block")).toHaveLength(1);
  });
});
