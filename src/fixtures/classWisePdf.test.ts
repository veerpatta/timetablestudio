import { describe, it, expect } from "vitest";
import { CLASS_WISE_PDF, ELGA } from "./classWisePdf";
import { makeRealVppsProject } from "./vppsReal";
import { deriveMaps } from "../domain/derive";
import { pdfSubjectLabel } from "../domain/reconcile";
import type { Day } from "../domain/types";

const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

describe("in-app grid matches Class_Wise.pdf cell-for-cell (M18 AC#1)", () => {
  const project = makeRealVppsProject();
  const tt = project.timetables.find((t) => t.id === project.activeTimetableId)!;
  const maps = deriveMaps(project, tt);
  const subjectName = new Map(project.subjects.map((s) => [s.id, s.name]));
  const teacherName = new Map(project.teachers.map((t) => [t.id, t.name]));

  const importedCell = (classId: string, day: Day, period: number): string => {
    const a = maps.classCells.get(classId)?.get(`${day}#${period}`)?.[0]?.activity;
    if (!a) return "Free";
    if (a.kind === "block") {
      // ELGA is the only true block; combined senior sections (M12) are blocks too
      // but carry a real subject — render them like a lesson for comparison.
      if (a.name === "ELGA") return ELGA;
      return `${pdfSubjectLabel(a.name)}|${a.teacherIds.map((t) => teacherName.get(t) ?? t).join("/")}`;
    }
    const subj = pdfSubjectLabel(subjectName.get(a.subjectId) ?? a.subjectId);
    return `${subj}|${a.teacherIds.map((t) => teacherName.get(t) ?? t).join("/")}`;
  };

  it("covers all 16 classes", () => {
    expect(Object.keys(CLASS_WISE_PDF)).toHaveLength(16);
    for (const name of Object.keys(CLASS_WISE_PDF)) {
      expect(project.classes.some((c) => c.id === name)).toBe(true);
    }
  });

  it("every cell matches the PDF (subject + teacher, under the alias map)", () => {
    const mismatches: string[] = [];
    for (const [classId, grid] of Object.entries(CLASS_WISE_PDF)) {
      grid.forEach((row, di) => {
        row.forEach((expected, pi) => {
          const got = importedCell(classId, DAYS[di]!, pi + 1);
          if (got !== expected) mismatches.push(`${classId} ${DAYS[di]} P${pi + 1}: pdf="${expected}" app="${got}"`);
        });
      });
    }
    if (mismatches.length) throw new Error(`${mismatches.length} mismatch(es):\n` + mismatches.slice(0, 40).join("\n"));
    expect(mismatches).toHaveLength(0);
  });
});
