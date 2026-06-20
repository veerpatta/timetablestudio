import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "../../store/projectStore";
import { App } from "./App";

describe("App shell (green-field)", () => {
  beforeEach(() => useProjectStore.getState().reset());

  it("opens on a Ready home with the school name and a clear primary action", () => {
    render(<App />);
    expect(screen.getByText("Timetable Studio")).toBeInTheDocument();
    expect(screen.getAllByText("Shri Veer Patta Senior Secondary School").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ready to publish/).length).toBeGreaterThan(0); // bundled is complete + clash-free
    expect(screen.getAllByRole("button", { name: "Make timetable" }).length).toBeGreaterThan(0);
  });

  it("shows the real timetable grid (ELGA team block) on the Timetable section", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Timetable" }));
    expect(screen.getAllByText("ELGA").length).toBeGreaterThan(0);
  });
});
