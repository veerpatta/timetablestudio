import { describe, it, expect } from "vitest";
import { serializeProject, deserializeProject, suggestFilename } from "./projectFile";
import { importLegacyRawData } from "../domain/legacyImport";
import { legacyRawSample } from "../fixtures/legacyRaw.sample";

describe("projectFile", () => {
  it("serialize → deserialize is a faithful round-trip", () => {
    const project = importLegacyRawData(legacyRawSample, "VPPS");
    const restored = deserializeProject(serializeProject(project));
    expect(restored).toEqual(project);
  });

  it("rejects non-JSON", () => {
    expect(() => deserializeProject("not json {")).toThrow(/not valid JSON/);
  });

  it("rejects an unsupported schemaVersion", () => {
    expect(() => deserializeProject(JSON.stringify({ schemaVersion: 99 }))).toThrow(
      /Unsupported schemaVersion/,
    );
  });

  it("suggests a slugged filename", () => {
    const project = importLegacyRawData(legacyRawSample, "Veer Patta Public School");
    expect(suggestFilename(project)).toBe("veer-patta-public-school.ttproj.json");
  });
});
