// Scenario ("try a change") session state — NOT persisted (it's a transient
// activity, not project data, so it never touches the domain Timetable schema).
// Orchestrates branch / discard / promote across projectStore + editorStore.

import { create } from "zustand";
import { useProjectStore } from "./projectStore";
import { useEditorStore } from "./editorStore";

interface ScenarioState {
  /** The live timetable we branched from. */
  baseId: string | null;
  /** The editable scenario draft. */
  branchId: string | null;
  active: boolean;
  /** Branch the active timetable into an editable copy and switch to it. */
  start: () => void;
  /** Throw the branch away and return to the live timetable. */
  discard: () => void;
  /** Replace the live timetable with the branch (undoable), then drop the branch. */
  promote: () => void;
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  baseId: null,
  branchId: null,
  active: false,

  start: () => {
    const ps = useProjectStore.getState();
    const project = ps.project;
    const baseId = project?.activeTimetableId;
    const baseTT = project?.timetables.find((t) => t.id === baseId);
    if (!project || !baseId || !baseTT) return;
    const branchId = ps.addDraft("Trying a change", baseTT.placements.map((p) => ({ ...p })));
    if (!branchId) return;
    useEditorStore.setState({ past: [], future: [] }); // fresh history for the branch
    set({ baseId, branchId, active: true });
  },

  discard: () => {
    const { baseId, branchId } = get();
    const ps = useProjectStore.getState();
    if (baseId) ps.setActiveTimetable(baseId);
    if (branchId) ps.deleteTimetable(branchId);
    set({ baseId: null, branchId: null, active: false });
  },

  promote: () => {
    const { baseId, branchId } = get();
    const ps = useProjectStore.getState();
    const project = ps.project;
    const branch = project?.timetables.find((t) => t.id === branchId);
    if (!project || !baseId || !branchId || !branch) return;
    const placements = branch.placements.map((p) => ({ ...p }));
    ps.setActiveTimetable(baseId);
    // Snapshot the live timetable, then commit the branch's placements onto it —
    // routed through editorStore so the single global Undo reverts the promote.
    useEditorStore.setState({ past: [], future: [] });
    useEditorStore.getState().replaceActivePlacements(placements);
    ps.deleteTimetable(branchId);
    set({ baseId: null, branchId: null, active: false });
  },
}));
