import { deriveMaps, findProfile, slotKey } from "../../domain/derive";
import type { Day, Id, Project, SlotDef, Timetable, Violation } from "../../domain/types";

interface Props {
  project: Project;
  timetable: Timetable;
  day: Day;
  selected?: { classId: Id; day: Day; slot: number } | null;
  violations?: Violation[];
  onSelectCell: (classId: Id, day: Day, slot: number) => void;
}

function names(project: Project) {
  return {
    subject: new Map(project.subjects.map((s) => [s.id, s.name])),
    teacher: new Map(project.teachers.map((t) => [t.id, t.name])),
  };
}

function classForSlot(flags: string[], selected: boolean, eventType?: string): string {
  const tint =
    eventType === "team_block"
      ? "bg-amber-50"
      : eventType === "joint_class"
        ? "bg-violet-50"
        : eventType === "free" || eventType === "self_study"
          ? "bg-slate-50"
          : "bg-white";
  const ring = selected ? "ring-2 ring-inset ring-sky-500" : "";
  const flag = flags.length ? "outline outline-2 -outline-offset-2 outline-rose-400" : "";
  return `border p-2 align-top text-left hover:bg-sky-50 ${tint} ${ring} ${flag}`;
}

function DayCell({ project, timetable, classId, day, slot, slotDef, selected, flags, onSelectCell }: {
  project: Project;
  timetable: Timetable;
  classId: Id;
  day: Day;
  slot: number;
  slotDef: SlotDef;
  selected: boolean;
  flags: string[];
  onSelectCell: Props["onSelectCell"];
}) {
  const maps = deriveMaps(project, timetable);
  const { subject, teacher } = names(project);
  const occ = maps.classCells.get(classId)?.get(slotKey(day, slot));
  const events = [...new Map((occ ?? []).map((o) => [o.eventId, o.event])).values()];
  const event = events[0];
  if (!slotDef.teaching) return <td className="border bg-slate-50 p-2 text-center text-xs text-slate-400">{slotDef.label}</td>;

  const label = `${project.classes.find((c) => c.id === classId)?.name ?? classId} ${day} ${slotDef.label}`;
  const title = flags.length ? flags.join(" | ") : undefined;
  const content = events.length > 1 ? (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold uppercase text-slate-400">Option line</div>
      {events.map((e) => (
        <div key={e.id} className="rounded bg-violet-50 px-1 py-0.5">
          <div className="font-medium">{subject.get(e.subjectId) ?? e.subjectId}</div>
          <div className="text-[10px] text-slate-500">{e.teacherIds.map((t) => teacher.get(t) ?? t).join(", ")}</div>
        </div>
      ))}
    </div>
  ) : event ? (
    <>
      <div className="font-medium text-slate-800">{subject.get(event.subjectId) ?? event.subjectId}</div>
      <div className="text-[11px] text-slate-500">{event.teacherIds.map((t) => teacher.get(t) ?? t).join(", ")}</div>
    </>
  ) : (
    <span className="text-slate-300">+</span>
  );

  return (
    <td
      role="button"
      tabIndex={0}
      aria-label={label}
      title={title}
      onClick={() => onSelectCell(classId, day, slot)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectCell(classId, day, slot);
        }
      }}
      className={classForSlot(flags, selected, event?.type)}
    >
      {content}
    </td>
  );
}

export function DayGrid({ project, timetable, day, selected, violations, onSelectCell }: Props): React.ReactElement {
  const profile = findProfile(project, timetable);
  if (!profile) return <p>Unknown profile.</p>;
  const flags = new Map<string, string[]>();
  for (const v of violations ?? []) {
    for (const s of v.slots) {
      if (!s.classId || s.day !== day) continue;
      const key = `${s.classId}#${s.slot}`;
      (flags.get(key) ?? flags.set(key, []).get(key)!).push(v.message);
    }
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th className="sticky left-0 z-10 border bg-slate-100 p-2 text-left">Class</th>
          {profile.slots.map((s) => (
            <th key={s.index} className={`border p-2 ${s.teaching ? "bg-slate-100" : "bg-slate-200 text-slate-500"}`}>
              <div className="font-semibold">{s.label}</div>
              <div className="text-[10px] font-normal text-slate-400">{s.start}-{s.end}</div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {project.classes.map((c) => (
          <tr key={c.id}>
            <th className="sticky left-0 z-10 border bg-slate-50 p-2 text-left font-medium">{c.name}</th>
            {profile.slots.map((s) => (
              <DayCell
                key={s.index}
                project={project}
                timetable={timetable}
                classId={c.id}
                day={day}
                slot={s.index}
                slotDef={s}
                selected={selected?.classId === c.id && selected.day === day && selected.slot === s.index}
                flags={flags.get(`${c.id}#${s.index}`) ?? []}
                onSelectCell={onSelectCell}
              />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
