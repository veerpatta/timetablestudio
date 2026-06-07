import { describe, expect, it } from "vitest";
import { buildBundledProject } from "../fixtures/bundled";
import { evaluateRules } from "./rules";
import { ruleSentence } from "./ruleText";
import { suggestRules } from "./suggestRules";
import type { Project } from "./types";

const tt = (p: Project) => p.timetables.find((t) => t.id === p.activeTimetableId)!;

describe("suggestRules detects real, non-duplicate patterns in the bundled timetable", () => {
  const project = buildBundledProject();
  const suggestions = suggestRules(project, tt(project));

  it("proposes at least 3 suggestions, with no duplicates", () => {
    expect(suggestions.length).toBeGreaterThanOrEqual(3);
    expect(new Set(suggestions.map((s) => s.id)).size).toBe(suggestions.length);
  });

  it("every suggestion is REAL — enabling it on the data it was detected from yields 0 violations", () => {
    for (const s of suggestions) {
      const withRule: Project = { ...project, rules: [s] };
      const violations = evaluateRules(withRule, tt(withRule));
      expect(violations, `${s.template} ${s.id}`).toHaveLength(0);
    }
  });

  it("every suggestion renders as a plain sentence with no codes", () => {
    for (const s of suggestions) {
      const sentence = ruleSentence(s, project);
      expect(sentence.length).toBeGreaterThan(0);
      expect(sentence).not.toMatch(/\b(R\d|HE\d)\b/);
    }
  });
});
