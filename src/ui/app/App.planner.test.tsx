import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "../../store/projectStore";
import { App } from "./App";

const constraints = () => useProjectStore.getState().project.constraints;

describe("Planner assistant workflow", () => {
  beforeEach(() => useProjectStore.getState().reset());

  it("opens around requests, runs an automatic plan, and applies the reviewed result", async () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "Make best timetable" })).toBeInTheDocument();
    expect(screen.getByText("Define what matters")).toBeInTheDocument();
    expect(screen.getByText("Planner result")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mon P1" }));
    fireEvent.click(screen.getByRole("button", { name: "Prefer this subject in the first half" }));
    expect(constraints().some((c) => c.template === "subject_half_of_day")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Make best timetable" }));

    const review = await screen.findByRole("region", { name: "Planner result" });
    expect(within(review).getByText(/requests improved/i)).toBeInTheDocument();
    expect(within(review).getByText(/Review changes/i)).toBeInTheDocument();

    fireEvent.click(within(review).getByRole("button", { name: "Apply this plan" }));
    expect(screen.getByText(/Plan applied/)).toBeInTheDocument();
  });
});
