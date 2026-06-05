import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "./App";
import { useProjectStore, makeDemoProject } from "../../store/projectStore";
import { useEditorStore } from "../../store/editorStore";
import { useUiStore } from "../../store/uiStore";

beforeEach(() => {
  useProjectStore.setState({ project: makeDemoProject(), initialized: true, storageStatus: "ready" });
  useEditorStore.setState({ past: [], future: [], selectedDay: "Mon", viewMode: "class" });
  useUiStore.setState({ tourOpen: true }); // simulate a first run
});

describe("guided tour (M14)", () => {
  it("renders on a fresh project, then closes for good once finished", () => {
    render(<App />);
    expect(screen.getByText("Welcome — here's the grid")).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 4/)).toBeInTheDocument();

    // Step through to the end.
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.queryByText("Welcome — here's the grid")).not.toBeInTheDocument();
    // The gate is closed and stays closed across a re-mount (no auto-reopen).
    expect(useUiStore.getState().tourOpen).toBe(false);
    render(<App />);
    expect(screen.queryByText("Welcome — here's the grid")).not.toBeInTheDocument();
  });

  it("can be replayed from Settings", () => {
    useUiStore.setState({ tourOpen: false });
    render(<App />);
    expect(screen.queryByText("Welcome — here's the grid")).not.toBeInTheDocument();
    // Navigate to Settings via the sidebar, then replay.
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    fireEvent.click(screen.getByRole("button", { name: /Replay the guided tour/ }));
    expect(screen.getByText("Welcome — here's the grid")).toBeInTheDocument();
  });
});
