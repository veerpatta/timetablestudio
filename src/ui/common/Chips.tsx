import { useState, type KeyboardEvent } from "react";

/** A tag/chip input — the structured replacement for newline/comma textareas
 * (M13 rule 12). Adds on Enter or comma; removes via the chip's ✕. Optional
 * datalist suggestions. Duplicates and blanks are rejected with no fuss. */
export function Chips({
  values,
  onAdd,
  onRemove,
  placeholder,
  suggestions = [],
  ariaLabel,
}: {
  values: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  placeholder?: string;
  suggestions?: string[];
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState("");
  const listId = `chips-${ariaLabel ?? placeholder ?? "x"}`.replace(/\s+/g, "-");

  const commit = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) onAdd(v);
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
      onRemove(values[values.length - 1]!);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1 rounded border border-slate-300 p-1">
      {values.map((v) => (
        <span
          key={v}
          className="flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
        >
          {v}
          <button
            type="button"
            onClick={() => onRemove(v)}
            aria-label={`Remove ${v}`}
            className="text-slate-400 hover:text-hard"
          >
            ✕
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={commit}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        list={suggestions.length ? listId : undefined}
        className="min-w-24 flex-1 px-1 py-0.5 text-sm outline-none"
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}
