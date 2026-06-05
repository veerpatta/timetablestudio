import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "./App";
import { useProjectStore, makeDemoProject } from "../../store/projectStore";
import { useEditorStore } from "../../store/editorStore";
import { useUiStore } from "../../store/uiStore";

beforeEach(() => {
  useProjectStore.setState({ project: makeDemoProject(), initialized: true });
  useEditorStore.setState({
    past: [],
    future: [],
    selectedDay: "Mon",
    viewMode: "class",
    gridView: "day",
    weekScope: null,
  });
  useUiStore.setState({ advanced: false });
});

describe("M8 acceptance — plain-language app shell", () => {
  it("offers the five everyday actions in plain language (no dev jargon)", () => {
    render(<App />);
    // 1 change a lesson → the editable day grid is present
    expect(screen.getByText("Whole school")).toBeInTheDocument();
    // 3 fill the gaps
    expect(screen.getByText("Fill the gaps")).toBeInTheDocument();
    // create timetables (generation, plain label)
    expect(screen.getByText("Create timetables")).toBeInTheDocument();
    // 4 print a person's week
    expect(screen.getByText("One person/class")).toBeInTheDocument();
    expect(screen.getByText(/Print/)).toBeInTheDocument();
    // 5 mark a teacher absent
    expect(screen.getByText(/Substitutions/)).toBeInTheDocument();

    // no developer jargon in the default UI
    expect(screen.queryByText(/seed/i)).not.toBeInTheDocument();
    expect(screen.queryByText("H1")).not.toBeInTheDocument();
    expect(screen.queryByText(/infeasible/i)).not.toBeInTheDocument();
  });

  it("Escape closes a modal (AC)", () => {
    render(<App />);
    // M13: data management moved to sidebar pages; File (export/import) stays a modal.
    fireEvent.click(screen.getByText(/File/));
    expect(screen.getByText("Export / Import")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("Export / Import")).not.toBeInTheDocument();
  });

  it("ELGA shows once as a band in the day grid (AC)", () => {
    render(<App />);
    const elga = screen.getAllByText(/^ELGA \(/);
    expect(elga).toHaveLength(1);
    expect(elga[0]!.closest("td")!.getAttribute("rowspan")).toBe("5");
  });

  it("switching to a class week shows that class's week grid", () => {
    render(<App />);
    fireEvent.click(screen.getByText("One person/class"));
    // default scope is the first class → its week renders
    expect(screen.getByText(/Class: Class 1/)).toBeInTheDocument();
  });
});
