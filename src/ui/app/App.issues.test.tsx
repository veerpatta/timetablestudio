// Integration: the Issues panel (in the Timetable section) detects a clash that arrived from
// OUTSIDE the legal-only editor (injected here directly, as a teacher reassignment / import
// would), lets the owner jump to it and fix it in one click, and the fix is undoable.

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

const goTimetable = () => fireEvent.click(screen.getByRole("button", { name: "Timetable" }));

describe("Issues panel (clash from outside the editor)", () => {
  it("shows a plain-language problem, fixes it in one click, and the fix is undoable", () => {
    seedClash();
    render(<App />);
    goTimetable();

    expect(screen.getByText(/Rule broken/)).toBeInTheDocument();
    expect(screen.getByText(/double-booked/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Fix it/ }));
    expect(screen.queryByText(/Rule broken/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText(/Rule broken/)).toBeInTheDocument();
  });

  it("'Show me' jumps to the offending cell (opens its editor)", () => {
    seedClash();
    render(<App />);
    goTimetable();
    fireEvent.click(screen.getByRole("button", { name: "Show me" }));
    const inspector = screen.getByRole("region", { name: "Cell inspector" });
    expect(within(inspector).getByText(/Mon P1/)).toBeInTheDocument();
  });
});
