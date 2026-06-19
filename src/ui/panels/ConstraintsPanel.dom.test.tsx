import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "../../store/projectStore";
import { App } from "../app/App";

const proj = () => useProjectStore.getState().project;

describe("Constraints panel (C3, through the UI)", () => {
  beforeEach(() => useProjectStore.getState().reset());

  it("builds a constraint from the sentence form, then toggles and removes it", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Requests" }));

    // default template is subject_half_of_day; tick Maths + Class 7 (first half default)
    fireEvent.click(screen.getByLabelText("Subjects: Maths"));
    fireEvent.click(screen.getByLabelText("For classes: Class 7"));
    fireEvent.click(screen.getByRole("button", { name: "Add constraint" }));

    expect(proj().constraints.length).toBe(1);
    expect(screen.getAllByText(/Maths in the first half of the day for Class 7/).length).toBeGreaterThanOrEqual(1);

    // toggle off then remove
    const id = proj().constraints[0]!.id;
    fireEvent.click(screen.getByLabelText(/Toggle .*Maths/));
    expect(proj().constraints.find((c) => c.id === id)?.enabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(proj().constraints.length).toBe(0);
  });

  it("a must constraint highlights the offending class cell (live)", () => {
    // place a Maths for Class 7 in an afternoon slot (P6 = slot 7), then add the must constraint
    const mathsTeacher = proj().qualifications.find((q) => q.subjectId === "Maths" && q.classId === "Class 7")!.teacherId;
    useProjectStore.getState().place("Class 7", "Mon", 7, "Maths", [mathsTeacher]);
    useProjectStore.getState().addConstraint({
      id: "c1", scope: "subject", severity: "must", weight: 1, enabled: true,
      template: "subject_half_of_day", params: { subjectIds: ["Maths"], classIds: ["Class 7"], half: "first" },
    });

    render(<App />);
    // By class → Class 7
    fireEvent.change(screen.getByRole("combobox", { name: /Class/ }), { target: { value: "Class 7" } });
    const cell = screen.getByRole("button", { name: "Mon P6" });
    expect(cell.getAttribute("title")).toMatch(/first half/);
    expect(cell.className).toMatch(/outline-rose-400/);
  });
});
