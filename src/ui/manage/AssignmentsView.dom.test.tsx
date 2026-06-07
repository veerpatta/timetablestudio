import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { isQualified } from "../../domain/assign";
import { useProjectStore } from "../../store/projectStore";
import { App } from "../app/App";

const proj = () => useProjectStore.getState().project;

describe("Who-teaches-what view (C2 AC, through the UI)", () => {
  beforeEach(() => useProjectStore.getState().reset());

  it("sets a class teacher (enabling the P1 rule) and edits the qualification matrix", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Setup" }));
    fireEvent.click(screen.getByRole("button", { name: "Who teaches what" }));

    // The default class is Class 1. Set its class teacher to Bindu — of the comboboxes,
    // the class-teacher one is the only that offers "— none —".
    const selects = screen.getAllByRole("combobox");
    const classTeacherSelect = selects.find((s) => within(s).queryByText("— none —"))!;
    fireEvent.change(classTeacherSelect, { target: { value: "Bindu" } });
    expect(proj().classes.find((c) => c.id === "Class 1")?.classTeacherId).toBe("Bindu");

    // The "takes period 1" checkbox is now enabled — turning it on adds the R4 rule.
    const p1 = screen.getByRole("checkbox", { name: /takes period 1/i }) as HTMLInputElement;
    expect(p1.disabled).toBe(false);
    fireEvent.click(p1);
    expect(proj().rules.some((r) => r.id === "R4:Class 1" && r.enabled)).toBe(true);

    // Add a teacher to a subject row that they aren't yet qualified for (changes the matrix).
    const before = proj().qualifications.length;
    const addSelect = screen.getByLabelText("Add a teacher for Maths") as HTMLSelectElement;
    const candidate = within(addSelect).getAllByRole("option").find((o) => (o as HTMLOptionElement).value)!;
    const teacherId = (candidate as HTMLOptionElement).value;
    fireEvent.change(addSelect, { target: { value: teacherId } });
    expect(proj().qualifications.length).toBe(before + 1);
    expect(isQualified(proj(), teacherId, "Maths", "Class 1")).toBe(true);
  });
});
