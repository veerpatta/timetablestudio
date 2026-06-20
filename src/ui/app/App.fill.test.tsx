import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { clearCell } from "../../domain/edit";
import { buildBundledProject } from "../../fixtures/bundled";
import { useProjectStore } from "../../store/projectStore";

const headerMakeBtn = () => screen.getAllByRole("button", { name: "Make timetable" })[0]!;

describe("Planner flow (review then apply / discard)", () => {
  it("proposes a reviewable plan for a cleared cell and applies it on request", async () => {
    const base = buildBundledProject();
    const ttId = base.activeTimetableId!;
    useProjectStore.setState({ project: clearCell(base, ttId, "Class 1", "Mon", 1), timetableId: ttId, past: [] });

    render(<App />);
    fireEvent.click(headerMakeBtn());

    const apply = await screen.findByRole("button", { name: "Apply this plan" }, { timeout: 5000 });
    fireEvent.click(apply);

    expect(screen.getByText(/Plan applied/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
  });

  it("Discard drops the proposed plan without applying anything", async () => {
    const base = buildBundledProject();
    const ttId = base.activeTimetableId!;
    useProjectStore.setState({ project: clearCell(base, ttId, "Class 1", "Mon", 1), timetableId: ttId, past: [] });

    render(<App />);
    fireEvent.click(headerMakeBtn());
    fireEvent.click(await screen.findByRole("button", { name: "Discard" }, { timeout: 5000 }));

    expect(screen.getByText(/Discarded the proposed plan/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  });
});
