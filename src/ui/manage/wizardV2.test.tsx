import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SetupWizard } from "./SetupWizard";
import { clearWizardDraft } from "../../persistence/wizardDraft";

beforeEach(() => clearWizardDraft());

describe("Wizard v2 (M13)", () => {
  it("uses chip inputs, not textareas, for structured data entry", () => {
    const { container } = render(<SetupWizard onClose={() => {}} />);
    // Step 1 → Classes
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("Add a class")).toBeInTheDocument();
    // No textarea anywhere in the wizard (the M13 zero-textarea rule).
    expect(container.querySelector("textarea")).toBeNull();
  });

  it("blocks Next with an inline reason until a class is added", () => {
    render(<SetupWizard onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" })); // → Classes step
    const next = screen.getByRole("button", { name: "Next" });
    expect(next).toBeDisabled();
    expect(screen.getByText(/Add at least one class/)).toBeInTheDocument();

    const input = screen.getByLabelText("Add a class");
    fireEvent.change(input, { target: { value: "Class 7" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("Class 7")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).not.toBeDisabled();
  });
});
