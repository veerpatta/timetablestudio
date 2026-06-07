// RB5 integration: "Fill the gaps" runs the solver, shows a REVIEWABLE diff, and applies
// it only on Accept (undoable) — nothing silent. In jsdom there is no Worker, so runFill
// falls back to the pure fill() on the main thread; the flow is identical.

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { clearCell } from "../../domain/edit";
import { buildBundledProject } from "../../fixtures/bundled";
import { useProjectStore } from "../../store/projectStore";

describe("RB5 Fill the gaps (review → accept)", () => {
  it("proposes a reviewable fill for a cleared cell and applies it on Accept", async () => {
    const base = buildBundledProject();
    const ttId = base.activeTimetableId!;
    // Make a gap: clear Class 1 Mon P1 (Maths/Bindu) → a Maths shortfall the solver can fill.
    const cleared = clearCell(base, ttId, "Class 1", "Mon", 1);
    useProjectStore.setState({ project: cleared, timetableId: ttId, past: [] });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Fill the gaps/ }));

    // The reviewable diff appears (async: solver resolves on the next tick).
    const accept = await screen.findByRole("button", { name: "Accept" });
    expect(screen.getByText(/proposed/)).toBeInTheDocument();

    fireEvent.click(accept);
    // Applied: review gone, header confirms, still clash-free, Undo available.
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    expect(screen.getByText(/Filled \d+ gap/)).toBeInTheDocument();
    expect(screen.getByText("No clashes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
  });

  it("Reject discards the fill (nothing applied)", async () => {
    const base = buildBundledProject();
    const ttId = base.activeTimetableId!;
    useProjectStore.setState({ project: clearCell(base, ttId, "Class 1", "Mon", 1), timetableId: ttId, past: [] });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Fill the gaps/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));

    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    expect(screen.getByText(/Discarded/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled(); // nothing was applied
  });
});
