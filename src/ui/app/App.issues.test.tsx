// RB3 integration: the Issues panel detects a clash that arrived from OUTSIDE the
// legal-only editor (injected here directly, as a teacher-reassignment / import / profile
// switch would), lets the owner jump to it and fix it in one click, and the fix is
// undoable. The editor itself cannot create a clash, so we seed one into the store.

import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { makeMiniSchool } from "../../fixtures/synthetic";
import { useProjectStore } from "../../store/projectStore";

function seedClash(): void {
  const project = makeMiniSchool();
  const table = project.timetables.find((t) => t.id === "tt")!;
  // Nidhika teaches Class 1 AND Class 2 Maths at the same slot — a real clash.
  table.placements = [
    { eventId: "evt-maths-c1", day: "Mon", slot: 1, pinned: false },
    { eventId: "evt-maths-c2", day: "Mon", slot: 1, pinned: false },
  ];
  useProjectStore.setState({ project, timetableId: "tt", past: [] });
}

describe("RB3 Issues panel (clash from outside the editor)", () => {
  it("shows a plain-language problem, fixes it in one click, and the fix is undoable", () => {
    seedClash();
    render(<App />);

    // The problem is listed in plain language (no codes), with a working fix.
    expect(screen.getByText(/Things to fix/)).toBeInTheDocument();
    expect(screen.getByText(/double-booked/i)).toBeInTheDocument();
    const fixBtn = screen.getByRole("button", { name: /Fix it/ });

    fireEvent.click(fixBtn);

    // Clash resolved: the problem panel is gone and the planner summary is visible.
    expect(screen.queryByText(/Things to fix/)).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Planner result" })).toBeInTheDocument();

    // Undo brings the problem back (the fix was reviewable + reversible).
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText(/Things to fix/)).toBeInTheDocument();
  });

  it("'Show me' jumps to the offending cell (opens its editor)", () => {
    seedClash();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Show me" }));
    // The right-side inspector opens on the jumped-to slot.
    const inspector = screen.getByRole("region", { name: "Cell inspector" });
    expect(within(inspector).getByText(/Mon P1/)).toBeInTheDocument();
  });
});
