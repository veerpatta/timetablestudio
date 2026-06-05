import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CompleteButton } from "./CompleteButton";
import { useProjectStore } from "../../store/projectStore";
import { buildProject, type BuildInput } from "../../domain/projectBuilder";

const overConstrained: BuildInput = {
  schoolName: "Tight",
  days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  periods: 6,
  classes: [
    { name: "Class A", group: "middle" },
    { name: "Class B", group: "middle" },
  ],
  teachers: [{ name: "Asha", subjects: ["Maths"], maxPeriodsPerWeek: 36 }],
  quotas: [
    { className: "Class A", subject: "Maths", teacher: "Asha", periodsPerWeek: 20 },
    { className: "Class B", subject: "Maths", teacher: "Asha", periodsPerWeek: 20 },
  ],
};

beforeEach(() => {
  useProjectStore.setState({ project: buildProject(overConstrained), initialized: true });
});

describe("CompleteButton — never silently apply infeasible (M9)", () => {
  it("shows a plain blocker report naming the bottleneck instead of solving", () => {
    render(<CompleteButton />);
    fireEvent.click(screen.getByText("Fill the gaps"));
    // No solving — a readable explanation appears instead.
    expect(screen.getByText(/can't be built yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Asha is needed for 40 periods/)).toBeInTheDocument();
    expect(screen.getByText(/💡/)).toBeInTheDocument();
  });
});
