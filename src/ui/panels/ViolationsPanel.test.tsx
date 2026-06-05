import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ViolationsPanel } from "./ViolationsPanel";
import { useUiStore } from "../../store/uiStore";
import type { Violation } from "../../domain/types";

const clash: Violation = {
  constraintId: "H1",
  severity: "hard",
  message: "Kusum is double-booked at Mon P4 (2 activities).",
  slots: [{ teacherId: "Kusum", day: "Mon", period: 4 }],
};

beforeEach(() => useUiStore.setState({ advanced: false }));

describe("ViolationsPanel (plain language + advanced)", () => {
  it("shows a plain sentence and hides the constraint code by default", () => {
    render(<ViolationsPanel violations={[clash]} />);
    expect(screen.getByText(/Kusum is double-booked/)).toBeInTheDocument();
    expect(screen.queryByText("[H1]")).not.toBeInTheDocument();
  });

  it("reveals the constraint code only in Advanced mode", () => {
    useUiStore.setState({ advanced: true });
    render(<ViolationsPanel violations={[clash]} />);
    expect(screen.getByText("[H1]")).toBeInTheDocument();
  });

  it("jumps to the conflict's day/period when 'view' is clicked", () => {
    const onJump = vi.fn();
    render(<ViolationsPanel violations={[clash]} onJump={onJump} />);
    fireEvent.click(screen.getByText("view"));
    expect(onJump).toHaveBeenCalledWith("Mon", 4);
  });
});
