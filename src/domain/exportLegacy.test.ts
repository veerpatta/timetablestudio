import { describe, expect, it } from "vitest";
import { buildBundledProject } from "../fixtures/bundled";
import { deriveMaps, findProfile, slotKey } from "./derive";
import { exportLegacyRawData } from "./exportLegacy";
import { teachingSlots } from "./profile";
import type { Day, Project } from "./types";

const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Parse the legacy text into class → "DayName Period k" → cell. */
function parse(text: string): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  let day = "";
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    if (DAY_FULL.includes(line.trim())) { day = line.trim(); continue; }
    const parts = line.split(",");
    if (parts[0] === "Class") continue; // header
    const cls = parts[0]!;
    const m = out.get(cls) ?? out.set(cls, new Map()).get(cls)!;
    for (let i = 1; i < parts.length; i++) m.set(`${day} P${i}`, parts[i]!);
  }
  return out;
}

describe("exportLegacyRawData round-trips against derive()", () => {
  const project: Project = buildBundledProject();
  const ttId = project.activeTimetableId!;
  const tt = project.timetables.find((t) => t.id === ttId)!;

  it("every class/day/period cell in the export equals the derived occupancy (Subject (Teacher) / Free)", () => {
    const parsed = parse(exportLegacyRawData(project, ttId));
    const profile = findProfile(project, tt)!;
    const maps = deriveMaps(project, tt);
    const teach = teachingSlots(profile);
    const subj = new Map(project.subjects.map((s) => [s.id, s.name]));
    const tea = new Map(project.teachers.map((t) => [t.id, t.name]));

    for (const c of project.classes) {
      const row = parsed.get(c.name);
      expect(row, c.name).toBeTruthy();
      DAYS.forEach((day, di) => {
        teach.forEach((slot, pi) => {
          const ev = maps.classCells.get(c.id)?.get(slotKey(day, slot))?.[0]?.event;
          const who = ev ? ev.teacherIds.map((t) => tea.get(t) ?? t).join(" / ") : "";
          const expected = !ev ? "Free" : who ? `${subj.get(ev.subjectId)} (${who})` : subj.get(ev.subjectId)!;
          expect(row!.get(`${DAY_FULL[di]} P${pi + 1}`)).toBe(expected);
        });
      });
    }
  });

  it("ELGA expands to the same block cell for all five primary classes (joint/team contract)", () => {
    const parsed = parse(exportLegacyRawData(project, ttId));
    const elga = parsed.get("Class 1")!.get("Monday P3"); // ELGA runs Mon P3
    expect(elga).toMatch(/^ELGA \(/);
    for (const cls of ["Class 2", "Class 3", "Class 4", "Class 5"]) {
      expect(parsed.get(cls)!.get("Monday P3")).toBe(elga);
    }
  });
});
