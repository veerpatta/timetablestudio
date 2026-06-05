import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore } from "./projectStore";
import { buildBundledProject, BUNDLED_DATA_VERSION } from "../fixtures/bundled";
import {
  saveProject,
  loadProject,
  listProjectKeys,
  deleteProject,
  CURRENT_KEY,
} from "../persistence/db";

/** A returning v4 browser: the real VPPS school saved before bundledDataVersion
 * existed (so it reads back as "older than the current bundled version"). */
function legacyStoredProject() {
  const p = buildBundledProject();
  const { bundledDataVersion: _omit, ...rest } = p;
  void _omit;
  return { ...rest, rules: [] }; // older shape: pre-rules, unstamped
}

async function clearStorage() {
  for (const key of await listProjectKeys()) await deleteProject(key);
}

beforeEach(async () => {
  await clearStorage();
  useProjectStore.setState({
    project: null,
    initialized: false,
    storageStatus: "loading",
    bundledStale: false,
    lastPreviousKey: null,
    previousKeys: [],
  });
});

describe("M19 stale bundled-data update (AC#2)", () => {
  it("init flags an older stored VPPS project as stale without overwriting it", async () => {
    const legacy = legacyStoredProject();
    await saveProject(legacy);

    await useProjectStore.getState().init();

    // The user's stored project is shown untouched, and the banner is offered.
    expect(useProjectStore.getState().bundledStale).toBe(true);
    expect(useProjectStore.getState().project!.rules).toHaveLength(0);
    expect(await loadProject()).toEqual(legacy);
  });

  it("one-click update adopts the latest and keeps the old timetable as a draft", async () => {
    const legacy = legacyStoredProject();
    await saveProject(legacy);
    await useProjectStore.getState().init();

    const ok = await useProjectStore.getState().adoptBundled();
    expect(ok).toBe(true);

    // Current project is now the latest bundled version, banner cleared.
    const current = useProjectStore.getState().project!;
    expect(current.bundledDataVersion).toBe(BUNDLED_DATA_VERSION);
    expect(current.rules.length).toBeGreaterThan(0);
    expect(useProjectStore.getState().bundledStale).toBe(false);

    // The old project was kept as a restorable draft — nothing silently lost.
    const prevKey = useProjectStore.getState().lastPreviousKey!;
    expect(prevKey).toBeTruthy();
    expect(await loadProject(prevKey)).toEqual(legacy);
    expect(useProjectStore.getState().previousKeys).toContain(prevKey);
  });

  it("undo restores the kept draft as the active project", async () => {
    const legacy = legacyStoredProject();
    await saveProject(legacy);
    await useProjectStore.getState().init();
    await useProjectStore.getState().adoptBundled();
    const prevKey = useProjectStore.getState().lastPreviousKey!;

    const restored = await useProjectStore.getState().restorePrevious(prevKey);
    expect(restored).toBe(true);
    expect(useProjectStore.getState().project!.rules).toHaveLength(0);
    // The restored project is back to current; the consumed draft key is gone.
    expect(useProjectStore.getState().previousKeys).not.toContain(prevKey);
    expect(await loadProject(CURRENT_KEY)).toEqual(legacy);
  });
});
