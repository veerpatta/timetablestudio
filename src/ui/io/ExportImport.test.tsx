import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
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
