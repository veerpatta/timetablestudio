// Generic CRUD list for teachers / subjects / classes (C1). Plain language only —
// no jargon on the surface (AGENTS standing rule). Removal is never silent: it opens
// an inline impact panel ("this affects N lessons…") that the user confirms; teacher
// removal offers to move the lessons to another teacher first (guided reassignment).

import { useState } from "react";
import type { EntityImpact, EntityKind } from "../../domain/references";

export interface EntityManagerProps {
  kind: EntityKind;
  /** Display title, e.g. "Teachers". */
  title: string;
  noun: string; // singular, e.g. "teacher"
  items: { id: string; name: string }[];
  impactOf: (id: string) => EntityImpact;
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string, reassignTo?: string) => void;
}

export function EntityManager(props: EntityManagerProps): React.ReactElement {
  const { kind, title, noun, items, impactOf, onAdd, onRename, onRemove } = props;
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [reassignTo, setReassignTo] = useState<string>("");

  const add = () => {
    const n = newName.trim();
    if (!n) return;
    onAdd(n);
    setNewName("");
  };
  const commitRename = (id: string) => {
    const n = editName.trim();
    if (n) onRename(id, n);
    setEditing(null);
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <input
          className="w-56 rounded border border-slate-300 px-2 py-1 text-sm"
          placeholder={`New ${noun} name`}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          aria-label={`New ${noun} name`}
        />
        <button onClick={add} className="rounded bg-slate-800 px-3 py-1 text-sm text-white disabled:opacity-40" disabled={!newName.trim()}>
          Add {noun}
        </button>
      </div>

      <ul className="divide-y divide-slate-100 rounded border border-slate-200">
        {items.map((it) => (
          <li key={it.id} className="px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              {editing === it.id ? (
                <input
                  className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                  value={editName}
                  autoFocus
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(it.id);
                    if (e.key === "Escape") setEditing(null);
                  }}
                  onBlur={() => commitRename(it.id)}
                  aria-label={`Rename ${it.name}`}
                />
              ) : (
                <span className="flex-1 text-sm">{it.name}</span>
              )}
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => { setEditing(it.id); setEditName(it.name); }}
                  className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50"
                >
                  Rename
                </button>
                <button
                  onClick={() => { setRemoving(it.id); setReassignTo(""); }}
                  disabled={items.length <= 1}
                  title={items.length <= 1 ? `Keep at least one ${noun}` : undefined}
                  className="rounded border border-rose-200 px-2 py-0.5 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            </div>

            {removing === it.id && (
              <RemovePanel
                kind={kind}
                noun={noun}
                impact={impactOf(it.id)}
                otherTeachers={kind === "teacher" ? items.filter((x) => x.id !== it.id) : []}
                reassignTo={reassignTo}
                setReassignTo={setReassignTo}
                onCancel={() => setRemoving(null)}
                onConfirm={() => { onRemove(it.id, kind === "teacher" && reassignTo ? reassignTo : undefined); setRemoving(null); }}
              />
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-400">{title}: {items.length}. Renaming is safe — it never breaks the timetable.</p>
    </div>
  );
}

function RemovePanel(props: {
  kind: EntityKind;
  noun: string;
  impact: EntityImpact;
  otherTeachers: { id: string; name: string }[];
  reassignTo: string;
  setReassignTo: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}): React.ReactElement {
  const { kind, noun, impact, otherTeachers, reassignTo, setReassignTo, onCancel, onConfirm } = props;
  const lines: string[] = [];
  if (impact.placements > 0) lines.push(`${impact.placements} timetable cell${impact.placements === 1 ? "" : "s"} (${impact.events.length} lesson${impact.events.length === 1 ? "" : "s"})`);
  if (impact.classTeacherOf.length > 0) lines.push(`class teacher of ${impact.classTeacherOf.map((c) => c.name).join(", ")}`);
  if (impact.rules.length > 0) lines.push(`${impact.rules.length} rule${impact.rules.length === 1 ? "" : "s"}`);

  return (
    <div className="mt-2 rounded border border-rose-200 bg-rose-50 p-3 text-sm">
      <p className="font-medium text-rose-800">Remove “{impact.name}”?</p>
      {lines.length > 0 ? (
        <p className="mt-1 text-rose-700">This affects {lines.join("; ")}.</p>
      ) : (
        <p className="mt-1 text-rose-700">Nothing else references this {noun}.</p>
      )}

      {kind === "teacher" && impact.placements > 0 && (
        <label className="mt-2 flex flex-wrap items-center gap-2 text-rose-800">
          <span>Move their lessons to:</span>
          <select className="rounded border border-rose-300 px-2 py-1" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
            <option value="">— leave the lessons without a teacher —</option>
            {otherTeachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      )}
      {kind !== "teacher" && impact.placements > 0 && (
        <p className="mt-1 text-rose-700">Those lessons will be deleted. You can Undo this.</p>
      )}

      <div className="mt-3 flex gap-2">
        <button onClick={onConfirm} className="rounded bg-rose-600 px-3 py-1 text-xs font-medium text-white hover:bg-rose-700">
          Remove
        </button>
        <button onClick={onCancel} className="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-white">
          Cancel
        </button>
      </div>
    </div>
  );
}
