// Regenerates src/fixtures/vpps.sample.ttproj.json from the legacy rawData
// snapshot. Run with: npx vite-node scripts/buildSampleFixture.ts
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { importLegacyRawData } from "../src/domain/legacyImport";
import { serializeProject } from "../src/persistence/projectFile";
import { legacyRawSample } from "../src/fixtures/legacyRaw.sample";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../src/fixtures/vpps.sample.ttproj.json");

const project = importLegacyRawData(legacyRawSample, "VPPS (sample)");
writeFileSync(out, serializeProject(project));
// eslint-disable-next-line no-console
console.log(`Wrote ${out}`);
