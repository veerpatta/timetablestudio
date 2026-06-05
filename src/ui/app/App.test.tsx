import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { App } from "./App";
import { useProjectStore, makeSampleProject } from "../../store/projectStore";
import { useEditorStore } from "../../store/editorStore";
import { lesson } from "../../fixtures/synthetic";

beforeEach(() => {
  // Seed an in-memory project so the editor renders (init() won't clobber it).
  useProjectStore.setState({ project: makeSampleProject(), initialized: true });
  useEditorStore.setState({ past: [], future: [], selectedDay: "Mon", viewMode: "class" });
});

describe("App (jsdom) — live editor", () => {
  it("renders the seeded sample grid and reports it feasible", async () => {
    render(<App />);
    expect(await screen.findByText("Maths (Bindu)")).toBeInTheDocument();
    expect(screen.getByText(/No conflicts/)).toBeInTheDocument();
  });

  it("flags H1 instantly when Kusum is placed opposite the ELGA block", async () => {
    render(<App />);
    await screen.findByText("Maths (Bindu)");

    // Place a Class 7 Hindi lesson with Kusum at Mon P4 (during ELGA).
    act(() =>
      useEditorStore.getState().add(lesson("L-clash", "Class 7", "Hindi", ["Kusum"]), "Mon", 4),
    );

    const badge = await screen.findByText("H1");
    expect(badge).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/Kusum is double-booked/)).toBeInTheDocument(),
    );
  });

  it("undo button reverts the last change", async () => {
    render(<App />);
    await screen.findByText("Maths (Bindu)");
    act(() =>
      useEditorStore.getState().add(lesson("L-clash", "Class 7", "Hindi", ["Kusum"]), "Mon", 4),
    );
    await screen.findByText("H1");

    fireEvent.click(screen.getByText("↶ Undo"));
    await waitFor(() => expect(screen.queryByText("H1")).not.toBeInTheDocument());
    expect(screen.getByText(/No conflicts/)).toBeInTheDocument();
  });
});
