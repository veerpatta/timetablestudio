import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "./App";
import { useProjectStore } from "../../store/projectStore";
import { useEditorStore } from "../../store/editorStore";
import { deleteProject, CURRENT_KEY } from "../../persistence/db";

beforeEach(async () => {
  await deleteProject(CURRENT_KEY);
  useProjectStore.setState({ project: null, initialized: false });
  useEditorStore.setState({ past: [], future: [], selectedDay: "Mon", viewMode: "class" });
});

describe("M7 onboarding (jsdom)", () => {
  it("a fresh user sees the empty state with three start paths (no auto-loaded sample)", async () => {
    render(<App />);
    expect(await screen.findByText(/Welcome to Timetable Studio/)).toBeInTheDocument();
    expect(screen.getByText("Set up my school")).toBeInTheDocument();
    expect(screen.getByText("Import existing timetable")).toBeInTheDocument();
    expect(screen.getByText(/Explore the demo/)).toBeInTheDocument();
    // It must NOT auto-load a conflicted sample.
    expect(screen.queryByText(/No conflicts|conflict/)).not.toBeInTheDocument();
  });

  it("Explore demo loads a full Mon–Sat timetable with no conflicts", async () => {
    render(<App />);
    fireEvent.click(await screen.findByText("Open demo"));
    // Saturday tab proves a 6-day week; "No conflicts" proves it's feasible.
    expect(await screen.findByRole("tab", { name: "Sat" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/no conflicts/i)).toBeInTheDocument());
  });

  it("Start setup opens the guided wizard", async () => {
    render(<App />);
    fireEvent.click(await screen.findByText("Start setup"));
    // Wizard step 1 content (the card title "Set up my school" also exists behind it).
    expect(await screen.findByText("Teaching days")).toBeInTheDocument();
    expect(screen.getByText("Periods per day")).toBeInTheDocument();
  });
});
