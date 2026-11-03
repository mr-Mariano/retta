"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { FieldError } from "@/components/form";
import { publishSlots, type PublishState } from "../../actions";

// Monday first, as people read a week; values are JS weekdays (0 = Sunday).
const WEEKDAYS = [
  { value: 1, label: "L", name: "lunes" },
  { value: 2, label: "M", name: "martes" },
  { value: 3, label: "M", name: "miércoles" },
  { value: 4, label: "J", name: "jueves" },
  { value: 5, label: "V", name: "viernes" },
  { value: 6, label: "S", name: "sábado" },
  { value: 0, label: "D", name: "domingo" },
];
const HOURS = ["07:00", "08:00", "09:00", "10:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"];
const DURATIONS = [
  { value: 60, label: "1 h" },
  { value: 90, label: "1 h 30" },
  { value: 120, label: "2 h" },
];
const PERIODS = [
  { value: 1, label: "1 semana" },
  { value: 2, label: "2 semanas" },
  { value: 4, label: "4 semanas" },
];

function Submit({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || count === 0} className="h-[52px] rounded-full bg-action text-[17px] font-semibold text-on-action disabled:opacity-50">
      {pending ? "Publicando…" : `Publicar ${count} horario${count === 1 ? "" : "s"}`}
    </button>
  );
}

export function PublishForm({ fieldId }: { fieldId: string }) {
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [hours, setHours] = useState<string[]>(["18:00", "19:00", "20:00", "21:00"]);
  const [duration, setDuration] = useState(60);
  const [weeks, setWeeks] = useState(2);
  const [state, action] = useActionState<PublishState, FormData>(publishSlots.bind(null, fieldId), {});
  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  // Upper bound: the server skips past times and the ones that already exist.
  const count = weekdays.length * hours.length * weeks;

  return (
    <form action={action} className="flex flex-1 flex-col gap-5">
      <Group label="Días de la semana">
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((day) => (
            <button
              key={day.value}
              type="button"
              onClick={() => setWeekdays((list) => toggle(list, day.value))}
              aria-pressed={weekdays.includes(day.value)}
              aria-label={day.name}
              className={`h-10 rounded-xl text-[15px] font-semibold ${weekdays.includes(day.value) ? "bg-action text-on-action" : "border border-line"}`}
            >
              {day.label}
            </button>
          ))}
        </div>
      </Group>
      <Group label="Horas de inicio">
        <div className="grid grid-cols-4 gap-2">
          {HOURS.map((hour) => (
            <button
              key={hour}
              type="button"
              onClick={() => setHours((list) => toggle(list, hour))}
              aria-pressed={hours.includes(hour)}
              className={`h-10 rounded-xl text-[15px] font-semibold ${hours.includes(hour) ? "bg-action text-on-action" : "border border-line"}`}
            >
              {hour.replace(/^0/, "")}
            </button>
          ))}
        </div>
      </Group>
      <Group label="Duración de cada horario">
        <Segmented options={DURATIONS} value={duration} onChange={setDuration} />
      </Group>
      <Group label="Durante">
        <Segmented options={PERIODS} value={weeks} onChange={setWeeks} />
      </Group>

      {weekdays.map((day) => (
        <input key={`d${day}`} type="hidden" name="weekday" value={day} />
      ))}
      {hours.map((hour) => (
        <input key={hour} type="hidden" name="time" value={hour} />
      ))}
      <input type="hidden" name="duration" value={duration} />
      <input type="hidden" name="weeks" value={weeks} />

      <div className="mt-auto flex flex-col gap-2.5 pt-2">
        <p className="rounded-[14px] border border-line bg-surface px-3.5 py-3 text-[15px]">
          <span className="font-semibold">Hasta {count} horarios</span>
          <span className="text-muted"> · se saltan los que ya pasaron o ya existen</span>
        </p>
        <FieldError id="publicar-error">{state.error}</FieldError>
        <Submit count={count} />
      </div>
    </form>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      {children}
    </div>
  );
}

function Segmented({ options, value, onChange }: { options: { value: number; label: string }[]; value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex rounded-[13px] border border-line bg-surface p-[3px]">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={option.value === value}
          className={`h-[38px] flex-1 rounded-[10px] text-sm font-semibold ${option.value === value ? "bg-action text-on-action" : "text-muted"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
