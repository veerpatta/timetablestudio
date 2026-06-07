import { describe, expect, it } from "vitest";
import { buildBundledProject } from "../fixtures/bundled";
import { clearCell } from "./edit";
import { ghostSuggestion } from "./ghost";
import { legalOptions } from "./legalMoves";

describe("ghostSuggestion: a faint, ALWAYS-legal best suggestion for empty slots", () => {
  const base = buildBundledProject();
  const ttId = base.activeTimetableId!;

  it("returns null for an occupied slot and for a non-teaching slot (Recess = 5)", () => {
    // Class 1 Mon P1 (slot 1) is Maths|Bindu — occupied.
    expect(ghostSuggestion(base, ttId, "Class 1", "Mon", 1)).toBeNull();
    // Recess is never a teaching slot.
    expect(ghostSuggestion(base, ttId, "Class 1", "Mon", 5)).toBeNull();
  });

  it("after clearing a Maths cell, suggests Maths (the now-short subject) and the suggestion is legal", () => {
    const cleared = clearCell(base, ttId, "Class 1", "Mon", 1);
    const ghost = ghostSuggestion(cleared, ttId, "Class 1", "Mon", 1);
    expect(ghost).not.toBeNull();
    expect(ghost!.subjectId).toBe("Maths");
    // The ghost is one of the genuinely legal placements (never unqualified/clashing).
    const legal = legalOptions(cleared, ttId, "Class 1", "Mon", 1);
    expect(legal.some((o) => o.subjectId === ghost!.subjectId && o.teacherIds[0] === ghost!.teacherIds[0])).toBe(true);
  });

  it("is deterministic — same inputs give the same suggestion", () => {
    const cleared = clearCell(base, ttId, "Class 1", "Mon", 1);
    expect(ghostSuggestion(cleared, ttId, "Class 1", "Mon", 1)).toEqual(
      ghostSuggestion(cleared, ttId, "Class 1", "Mon", 1),
    );
  });
});
