import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "../../store/projectStore";
import { App } from "./App";

const constraints = () => useProjectStore.getState().project.constraints;
const headerMakeBtn = () => screen.getAllByRole("button", { name: "Make timetable" })[0]!;

describe("Planner assistant workflow (green-field)", () => {
  beforeEach(() => useProjectStore.getState().reset());

  it("captures a request, runs a plan, and applies the reviewed result", async () => {
    render(<App />);

    // add a preference from a timetable cell
    fireEvent.click(screen.getByRole("button", { name: "Timetable" }));
    fireEvent.click(screen.getByRole("button", { name: "Mon P1" }));
    fireEvent.click(screen.getByRole("button", { name: "Prefer this subject in the first half" }));
    expect(constraints().some((c) => c.template === "subject_half_of_day")).toBe(true);

    // run the planner — lands on the Make-timetable review screen
    fireEvent.click(headerMakeBtn());
    const apply = await screen.findByRole("button", { name: "Apply this plan" }, { timeout: 5000 });
    expect(screen.getByText(/requests met/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Complete timetable|Best found|Time limit reached/i).length).toBeGreaterThan(0);

    fireEvent.click(apply);
    expect(screen.getByText(/Plan applied/)).toBeInTheDocument();
  });

  it("shows a proved-impossible message only when the solver can prove the setup is blocked", async () => {
    const project = useProjectStore.getState().project;
    useProjectStore.setState({
      project: {
        ...project,
        qualifications: [],
        requirements: [{ id: "req-impossible", classId: "Class 1", subjectId: "Maths", teacherIds: [], periodsPerWeek: 1 }],
      },
      timetableId: project.activeTimetableId!,
      past: [],
    });

    render(<App />);
    fireEvent.click(headerMakeBtn());

    expect((await screen.findAllByText(/Cannot satisfy these rules/i, {}, { timeout: 5000 })).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/qualified/i).length).toBeGreaterThan(0);
  });
});
