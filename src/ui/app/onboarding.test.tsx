import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "./App";
import { useProjectStore } from "../../store/projectStore";
import { useEditorStore } from "../../store/editorStore";
import { useUiStore } from "../../store/uiStore";
import { deleteProject, CURRENT_KEY } from "../../persistence/db";

beforeEach(async () => {
  await deleteProject(CURRENT_KEY);
  useProjectStore.setState({
    project: null,
    initialized: false,
    bundledStale: false,
    lastPreviousKey: null,
    previousKeys: [],
  });
  useEditorStore.setState({ past: [], future: [], selectedDay: "Mon", viewMode: "class" });
  useUiStore.setState({ tourOpen: false }); // keep the guided tour out of the way
});

describe("M19 zero-setup onboarding (jsdom)", () => {
  it("a fresh user opens straight into the real school timetable — no welcome screen", async () => {
    render(<App />);
    // The built-in school is live with a full 6-day week and no conflicts —
    // no empty state, no user action.
    expect(await screen.findByRole("tab", { name: "Sat" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/no conflicts/i)).toBeInTheDocument());
    expect(screen.getAllByText(/Veer Patta Public School/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Welcome to Timetable Studio/)).not.toBeInTheDocument();
  });

  it("'Start a different school' (Settings) opens the guided wizard", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /Settings/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Start a different school" }));
    // The guided wizard modal (its heading is unique to the wizard).
    expect(await screen.findByRole("heading", { name: "Set up my school" })).toBeInTheDocument();
  });
});
