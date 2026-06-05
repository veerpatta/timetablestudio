import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";

// Simulate a wedged IndexedDB: `openDB` never resolves (e.g. a blocked upgrade
// held open by another tab), `deleteDB` resolves so "Start fresh" can recover.
vi.mock("idb", () => ({
  openDB: vi.fn(() => new Promise(() => {})),
  deleteDB: vi.fn(() => Promise.resolve()),
}));

import { App } from "./App";
import { useProjectStore } from "../../store/projectStore";

describe("App — storage resilience (M11)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useProjectStore.setState({
      project: null,
      initialized: false,
      storageStatus: "loading",
      saveFailed: false,
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("shows the recovery screen when IndexedDB never opens — no endless spinner", async () => {
    render(<App />);
    // The shell shows a bounded spinner while init() runs…
    expect(screen.getByText("Loading…")).toBeInTheDocument();

    // …then the ~3s storage timeout fires and flips to the recovery screen.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });

    expect(screen.getByText("We couldn't open your saved data")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });

  it("'Start fresh' clears storage and lands on a working empty state", async () => {
    render(<App />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(screen.getByText("We couldn't open your saved data")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start fresh/ }));
      await vi.advanceTimersByTimeAsync(3100);
    });

    // Empty state with the three onboarding paths — a usable starting point.
    expect(screen.getByText("Welcome to Timetable Studio")).toBeInTheDocument();
    expect(screen.getByText("Set up my school")).toBeInTheDocument();
    expect(useProjectStore.getState().storageStatus).toBe("ready");
  });
});
