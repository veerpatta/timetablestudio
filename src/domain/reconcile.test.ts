import { describe, it, expect } from "vitest";
import { reconcileWithPdf, pdfSubjectLabel, HEATWAVE_BREAK } from "./reconcile";
import { makeRealVppsProject } from "../fixtures/vppsReal";
import { deriveMaps } from "./derive";

describe("Class_Wise.pdf reconciliation (M18)", () => {
  const project = makeRealVppsProject();
  const tt = project.timetables.find((t) => t.id === project.activeTimetableId)!;
  const profile = project.profiles.find((p) => p.id === tt.profileId)!;

  it("flags exactly the four board classes (10, 12 Arts/Commerce/Science)", () => {
    const board = (name: string) => project.classes.find((c) => c.id === name)?.isBoardClass === true;
    expect(board("Class 10")).toBe(true);
    expect(board("Class 12 Arts")).toBe(true);
    expect(board("Class 12 Commerce")).toBe(true);
    expect(board("Class 12 Science")).toBe(true);
    // NOT the 11 streams or any non-board class.
    expect(project.classes.find((c) => c.id === "Class 11 Science")?.isBoardClass).toBeFalsy();
    expect(project.classes.find((c) => c.id === "Class 9")?.isBoardClass).toBeFalsy();
    expect(project.classes.filter((c) => c.isBoardClass)).toHaveLength(4);
  });

  it("adds the positioned break after P4 (10:10–10:25)", () => {
    expect(profile.break).toEqual(HEATWAVE_BREAK);
  });

  it("fills the real heatwave clock the rawData import drops", () => {
    expect(profile.periods[0]).toMatchObject({ start: "07:30", end: "08:10" });
    expect(profile.periods[3]).toMatchObject({ start: "09:30", end: "10:10" }); // P4 ends at the break
    expect(profile.periods[4]).toMatchObject({ start: "10:25", end: "11:05" }); // P5 resumes after it
    expect(profile.periods[5]).toMatchObject({ start: "11:05", end: "11:45" });
  });

  it("maps verbose rawData subject labels to the PDF's canonical ones", () => {
    expect(pdfSubjectLabel("English compulsory")).toBe("English");
    expect(pdfSubjectLabel("Core Revision")).toBe("Revision");
    expect(pdfSubjectLabel("English Literature")).toBe("Eng. Lit.");
    expect(pdfSubjectLabel("Political Science")).toBe("Pol. Sci.");
    expect(pdfSubjectLabel("Business Studies")).toBe("B. Studies");
    expect(pdfSubjectLabel("Maths")).toBe("Maths"); // identity for unaliased subjects
  });

  it("the imported grid matches Class_Wise.pdf on the board-class P1 anchors", () => {
    // Spot-check the authoritative board pages cell-for-cell (subject + teacher).
    const maps = deriveMaps(project, tt);
    const cell = (classId: string, day: string, period: number) => {
      const occ = maps.classCells.get(classId)?.get(`${day}#${period}`)?.[0];
      const a = occ?.activity;
      if (!a || a.kind !== "lesson") return null;
      const subj = project.subjects.find((s) => s.id === a.subjectId)?.name ?? a.subjectId;
      return `${pdfSubjectLabel(subj)} / ${a.teacherIds.join(",")}`;
    };
    expect(cell("Class 10", "Mon", 1)).toBe("SST / Pradhyuman");
    expect(cell("Class 12 Commerce", "Mon", 1)).toBe("Accountancy / Nathulal");
    expect(cell("Class 12 Science", "Mon", 1)).toBe("Chemistry / Toshit");
    expect(cell("Class 12 Arts", "Mon", 1)).toBe("Geography / Prakash");
  });

  it("reconcile is idempotent on cell data (no subject/teacher rewrite)", () => {
    const once = reconcileWithPdf(project);
    expect(once.timetables[0]!.placements).toEqual(project.timetables[0]!.placements);
    expect(once.subjects).toEqual(project.subjects);
  });
});
