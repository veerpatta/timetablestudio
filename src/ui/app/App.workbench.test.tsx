import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "../../store/projectStore";
import { App } from "./App";

const project = () => useProjectStore.getState().project;

describe("Workbench editing surface", () => {
  beforeEach(() => useProjectStore.getState().reset());

  it("opens as a timetable workbench with a left rail and right inspector", () => {
    render(<App />);

    expect(screen.getByRole("navigation", { name: "Workbench sections" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Timetable" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Requests" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Cell inspector" })).toBeInTheDocument();
    expect(screen.getByText("Select a timetable cell")).toBeInTheDocument();
  });

  it("opens the selected-cell inspector from the class grid and adds a preference request", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Mon P1" }));

    expect(screen.getByText("Selected cell")).toBeInTheDocument();
    expect(screen.getByText("Legal replacements")).toBeInTheDocument();
    expect(screen.getByText("Affects this teacher")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Prefer this subject in the first half" }));

    const added = project().constraints.find((c) => c.id.startsWith("quick:first-half:"));
    expect(added).toMatchObject({
      template: "subject_half_of_day",
      severity: "prefer",
      enabled: true,
    });
  });

  it("edits from the day view and keeps the same inspector workflow", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Day" }));
    fireEvent.click(screen.getByRole("button", { name: "Class 1 Mon P1" }));

    const inspector = screen.getByRole("region", { name: "Cell inspector" });
    expect(within(inspector).getByText("Selected cell")).toBeInTheDocument();
    expect(within(inspector).getAllByText(/Class 1/).length).toBeGreaterThan(0);
    expect(within(inspector).getByText(/Mon P1/)).toBeInTheDocument();
  });

  it("opens the same inspector from teacher mode", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Teacher" }));
    fireEvent.change(screen.getByRole("combobox", { name: /Teacher/ }), { target: { value: "Bindu" } });
    fireEvent.click(screen.getByRole("button", { name: "Bindu Mon P1" }));

    const inspector = screen.getByRole("region", { name: "Cell inspector" });
    expect(within(inspector).getByText("Selected cell")).toBeInTheDocument();
    expect(within(inspector).getByText(/Maths for Class 1/)).toBeInTheDocument();
  });
});
