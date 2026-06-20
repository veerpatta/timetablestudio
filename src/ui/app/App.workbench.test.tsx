import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "../../store/projectStore";
import { App } from "./App";

const project = () => useProjectStore.getState().project;
const goTimetable = () => fireEvent.click(screen.getByRole("button", { name: "Timetable" }));

describe("Workbench editing surface (green-field)", () => {
  beforeEach(() => useProjectStore.getState().reset());

  it("opens on a guided home with navigation and a primary action", () => {
    render(<App />);
    expect(screen.getByRole("navigation", { name: "Sections" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Make timetable" }).length).toBeGreaterThan(0);
    expect(screen.getByText("How it works")).toBeInTheDocument();
  });

  it("opens the cell inspector from the class grid and adds a preference request", () => {
    render(<App />);
    goTimetable();

    fireEvent.click(screen.getByRole("button", { name: "Mon P1" }));
    expect(screen.getByText("Selected cell")).toBeInTheDocument();
    expect(screen.getByText("Legal replacements")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Prefer this subject in the first half" }));
    expect(project().constraints.find((c) => c.id.startsWith("quick:first-half:"))).toMatchObject({
      template: "subject_half_of_day",
      severity: "prefer",
      enabled: true,
    });
  });

  it("offers common quick requests from a selected cell", () => {
    render(<App />);
    goTimetable();

    fireEvent.click(screen.getByRole("button", { name: "Mon P1" }));
    fireEvent.click(screen.getByRole("button", { name: "Spread this subject across the week" }));
    fireEvent.click(screen.getByRole("button", { name: "Limit this teacher's weekly periods" }));

    expect(project().constraints.some((c) => c.template === "subject_spread_min_days")).toBe(true);
    expect(project().constraints.some((c) => c.template === "teacher_max_per_week")).toBe(true);
    expect(screen.getByText(/request saved/i)).toBeInTheDocument();
  });

  it("opens the same inspector from teacher mode", () => {
    render(<App />);
    goTimetable();

    fireEvent.click(screen.getByRole("button", { name: "By teacher" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Bindu" } });
    fireEvent.click(screen.getByRole("button", { name: "Bindu Mon P1" }));

    const inspector = screen.getByRole("region", { name: "Cell inspector" });
    expect(within(inspector).getByText("Selected cell")).toBeInTheDocument();
  });
});
