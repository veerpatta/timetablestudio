import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ExportImport } from "./ExportImport";
import { useProjectStore, makeSampleProject } from "../../store/projectStore";
import { serializeProject } from "../../persistence/projectFile";

beforeEach(() => {
  useProjectStore.setState({ project: makeSampleProject() });
});

describe("ExportImport (jsdom)", () => {
  it("shows the legacy rawData export for the active timetable", () => {
    render(<ExportImport onClose={() => {}} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toContain("Monday");
    expect(textarea.value).toContain("ELGA (Bindu / Anita / Rashmita / Kusum / Ravina)");
  });

  it("legacy import shows an editable quota review before committing (M12 AC3)", async () => {
    const before = useProjectStore.getState().project!.school.name;
    const onClose = vi.fn();
    render(<ExportImport onClose={onClose} />);

    const legacyInput = document.querySelector('input[accept*="text/plain"]') as HTMLInputElement;
    const raw = [
      "Monday",
      "Class,Period 1,Period 2",
      "Class 7,Maths (Nidhika),Maths (Nidhika)",
    ].join("\n");
    const file = new File([raw], "vpps.txt", { type: "text/plain" });
    await act(async () => {
      fireEvent.change(legacyInput, { target: { files: [file] } });
    });

    // Review screen appears; the project is NOT yet committed.
    await screen.findByText("Check your weekly subjects");
    expect(useProjectStore.getState().project!.school.name).toBe(before);

    // Adjust the inferred Maths quota, then confirm.
    const input = screen.getByLabelText(/Maths periods per week for Class 7/i) as HTMLInputElement;
    expect(input.value).toBe("2"); // inferred: Maths placed twice on Monday
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /Looks right/i }));

    await waitFor(() => {
      const p = useProjectStore.getState().project!;
      expect(p.school.name).toBe("vpps");
      const req = p.requirements.curriculum.find(
        (r) => r.classId === "Class 7" && r.subjectId === "Maths",
      );
      expect(req?.periodsPerWeek).toBe(5);
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("imports a JSON project file and replaces the store project", async () => {
    // Build a distinct project to import.
    const imported = { ...makeSampleProject(), school: { name: "Imported School" } };
    render(<ExportImport onClose={() => {}} />);

    const fileInput = document.querySelector('input[accept*="json"]') as HTMLInputElement;
    const file = new File([serializeProject(imported)], "p.ttproj.json", { type: "application/json" });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() =>
      expect(useProjectStore.getState().project!.school.name).toBe("Imported School"),
    );
    expect(screen.getByText(/Imported project/)).toBeInTheDocument();
  });
});
