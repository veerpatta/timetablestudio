// C7 AC through the UI: an Arts student in a chosen combination is SHOWN a clean personal
// timetable — the dropped elective never appears, Self Study and a chosen elective do.

import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PersonalTimetable } from "./PersonalTimetable";
import { seedArtsElectives } from "../../domain/electives";
import { buildBundledProject } from "../../fixtures/bundled";
import type { Project } from "../../domain/types";

const tableOf = (p: Project) => p.timetables.find((t) => t.id === p.activeTimetableId)!;

describe("Personal timetable (C7, through the UI)", () => {
  it("shows the drop-Economics combination with no Economics, plus Self Study", () => {
    const base = seedArtsElectives(buildBundledProject());
    render(<PersonalTimetable project={base} timetable={tableOf(base)} />);

    // pick the Class 11 Arts combination that dropped Economics
    const dropEco = base.studentGroups.find((g) => g.id === "sg:Class 11 Arts:drop:Economics")!;
    fireEvent.change(screen.getByLabelText("Combination"), { target: { value: dropEco.id } });

    const grid = screen.getByRole("table");
    // dropped elective absent; Self Study (the supervised replacement) present; a chosen one present
    expect(within(grid).queryByText(/Economics/)).not.toBeInTheDocument();
    expect(within(grid).getAllByText(/Self Study/).length).toBeGreaterThan(0);
    expect(within(grid).getAllByText(/Geography/).length).toBeGreaterThan(0);
  });
});
