import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App (RB1 read-only shell)", () => {
  it("opens to the real timetable with no clashes and a class grid", () => {
    render(<App />);
    expect(screen.getByText("Shri Veer Patta Senior Secondary School")).toBeInTheDocument();
    expect(screen.getByText("All clear")).toBeInTheDocument();
    // ELGA team block renders for the default class (Class 1).
    expect(screen.getAllByText("ELGA").length).toBeGreaterThan(0);
  });
});
