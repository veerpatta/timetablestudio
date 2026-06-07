import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { findDanglingRefs } from "../../domain/references";
import { validate } from "../../domain/validate";
import { useProjectStore } from "../../store/projectStore";
import { App } from "../app/App";

const proj = () => useProjectStore.getState().project;
const hard = () => {
  const p = proj();
  const tt = p.timetables.find((t) => t.id === p.activeTimetableId)!;
  return validate(p, tt).filter((v) => v.severity === "hard").length;
};

describe("Setup view — the C1 acceptance flow through the UI", () => {
  beforeEach(() => useProjectStore.getState().reset());

  it("a user adds a teacher, renames a subject, and removes a class — no dangling ref, no clash", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Setup" }));

    // 1) Add a teacher
    const before = proj().teachers.length;
    fireEvent.change(screen.getByLabelText("New teacher name"), { target: { value: "Ms Fresh" } });
    fireEvent.click(screen.getByRole("button", { name: "Add teacher" }));
    expect(proj().teachers.length).toBe(before + 1);
    expect(proj().teachers.some((t) => t.name === "Ms Fresh")).toBe(true);

    // 2) Rename a subject (id stays "Maths", display name changes)
    fireEvent.click(screen.getByRole("button", { name: "Subjects" }));
    const mathsRow = screen.getByText("Maths").closest("li")!;
    fireEvent.click(within(mathsRow).getByRole("button", { name: "Rename" }));
    const input = within(mathsRow).getByLabelText("Rename Maths");
    fireEvent.change(input, { target: { value: "Mathematics" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(proj().subjects.find((s) => s.id === "Maths")?.name).toBe("Mathematics");

    // 3) Remove a class that participates in a joint (the hard case)
    fireEvent.click(screen.getByRole("button", { name: "Classes" }));
    const row = screen.getByText("Class 11 Commerce").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "Remove" }));
    // impact panel appears; the confirm button is the second "Remove" in the row
    const removeButtons = within(row).getAllByRole("button", { name: "Remove" });
    fireEvent.click(removeButtons[removeButtons.length - 1]!);
    expect(proj().classes.some((c) => c.id === "Class 11 Commerce")).toBe(false);

    // The C1 guarantee: nothing dangles and the timetable stays clash-free.
    expect(findDanglingRefs(proj())).toEqual([]);
    expect(hard()).toBe(0);
  });
});
