import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { clearCell } from "../../domain/edit";
import { buildBundledProject } from "../../fixtures/bundled";
import { useProjectStore } from "../../store/projectStore";

describe("RB5 Planner flow (review then apply)", () => {
  it("proposes a reviewable plan for a cleared cell and applies it on request", async () => {
    const base = buildBundledProject();
    const ttId = base.activeTimetableId!;
    const cleared = clearCell(base, ttId, "Class 1", "Mon", 1);
    useProjectStore.setState({ project: cleared, timetableId: ttId, past: [] });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Make best timetable" }));

    const review = await screen.findByRole("region", { name: "Planner result" });
    expect(within(review).getByText(/Review changes/)).toBeInTheDocument();
    fireEvent.click(within(review).getByRole("button", { name: "Apply this plan" }));

    expect(screen.getByText(/Plan applied/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
  });

  it("Reject discards the proposed plan without applying anything", async () => {
    const base = buildBundledProject();
    const ttId = base.activeTimetableId!;
    useProjectStore.setState({ project: clearCell(base, ttId, "Class 1", "Mon", 1), timetableId: ttId, past: [] });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Make best timetable" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));

    expect(screen.getByText(/Discarded proposed plan/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  });
});
