// Solves the demo school ONCE at build time (deterministic, generous budget) and
// writes src/fixtures/vpps.demo.ttproj.json. Run:
//   npx vite-node scripts/buildDemoFixture.ts
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildDemoSchool } from "../src/fixtures/demoSchool";
import { solve } from "../src/solver/engine";
import { validate } from "../src/domain/validate";
import { serializeProject } from "../src/persistence/projectFile";
import type { Project } from "../src/domain/types";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../src/fixtures/vpps.demo.ttproj.json");

const base = buildDemoSchool();

// Per-teacher weekly load sanity (must be <= maxPeriodsPerWeek and <= 6*days).
const load = new Map<string, number>();
for (const r of base.requirements.curriculum) {
  for (const t of r.teacherIds) load.set(t, (load.get(t) ?? 0) + r.periodsPerWeek);
}
// eslint-disable-next-line no-console
console.log("Per-teacher weekly required periods:");
for (const [t, n] of [...load.entries()].sort((a, b) => b[1] - a[1])) {
  // eslint-disable-next-line no-console
  console.log(`  ${t}: ${n}`);
}

const SEED = 20260605;
const result = solve(base, base.activeTimetableId!, { mode: "generate", seed: SEED, maxMillis: 30000 });

const solved: Project = {
  ...base,
  timetables: base.timetables.map((t) =>
    t.id === base.activeTimetableId ? { ...t, placements: result.placements } : t,
  ),
};
const hard = validate(solved, solved.timetables[0]!).filter((v) => v.severity === "hard");

// eslint-disable-next-line no-console
console.log(
  `\nsolve: complete=${result.complete} feasible=${result.feasible} hard=${hard.length} iterations=${result.iterations} millis=${result.millis} placements=${result.placements.length}`,
);
if (!result.complete || hard.length > 0) {
  // eslint-disable-next-line no-console
  console.error("DEMO NOT FEASIBLE — adjust quotas/teacher assignment.");
  hard.slice(0, 8).forEach((v) => console.error("  " + v.message));
  process.exit(1);
}

writeFileSync(out, serializeProject(solved));
// eslint-disable-next-line no-console
console.log(`Wrote ${out}`);
