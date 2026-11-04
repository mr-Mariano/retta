"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useMemo, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { FieldError } from "@/components/form";
import { dayKey, formatDay, formatTime, TIME_ZONE } from "@/lib/time";
import { createMatch, type CreateMatchState } from "../actions";
import { coverSrc } from "@/lib/covers";

export interface FieldOption {
  id: string;
  name: string;
  area: string | null;
  cover_image: string;
}

export interface SlotOption {
  id: string;
  fieldId: string;
  startsAt: string;
  endsAt: string;
  taken: boolean;
}

const STEPS = ["horario", "jugadores", "precio", "tipo", "revisar"] as const;
const FORMATS = [
  { value: "fut5", label: "Fut 5" },
  { value: "fut7", label: "Fut 7" },
  { value: "fut11", label: "Fut 11" },
];
const LEVELS = [
  { value: "beginner", label: "Principiante" },
  { value: "intermediate", label: "Intermedio" },
  { value: "advanced", label: "Avanzado" },
];
const TYPES = [
  { value: "men", label: "Varonil" },
  { value: "women", label: "Femenil" },
  { value: "mixed", label: "Mixto" },
];
const label = (options: { value: string; label: string }[], value: string) => options.find((o) => o.value === value)?.label ?? "";

const HOUR_MS = 60 * 60 * 1000;

/** Closing options that the database accepts: same day, at least 1 h before start, still ahead. */
function deadlineOptions(startsAt: string) {
  const start = new Date(startsAt);
  return [3, 2, 1].filter((hours) => {
    const deadline = new Date(start.getTime() - hours * HOUR_MS);
    return deadline.getTime() > Date.now() && dayKey(deadline) === dayKey(start);
  });
}

/** Create match (variant A, session 7): one question per screen, then review and publish. */
export function CreateFlow({ fields, slots }: { fields: FieldOption[]; slots: SlotOption[] }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const firstField = fields.find((field) => slots.some((slot) => slot.fieldId === field.id && !slot.taken)) ?? fields[0];
  const [fieldId, setFieldId] = useState(firstField?.id ?? "");
  const [day, setDay] = useState(dayKey(new Date()));
  const [slotId, setSlotId] = useState("");
  const [min, setMin] = useState(10);
  const [max, setMax] = useState(14);
  const [price, setPrice] = useState("80");
  const [format, setFormat] = useState("fut7");
  const [level, setLevel] = useState("intermediate");
  const [type, setType] = useState("mixed");
  const [deadlineHours, setDeadlineHours] = useState(3);
  const [extras, setExtras] = useState(false);
  const [state, action] = useActionState<CreateMatchState, FormData>(createMatch, {});

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(Date.now() + i * 24 * HOUR_MS)), []);
  const field = fields.find((f) => f.id === fieldId);
  const daySlots = slots.filter((slot) => slot.fieldId === fieldId && dayKey(new Date(slot.startsAt)) === day);
  const slot = slots.find((s) => s.id === slotId);
  const closes = slot ? deadlineOptions(slot.startsAt) : [];
  const hours = closes.includes(deadlineHours) ? deadlineHours : (closes[0] ?? 1);
  const pesos = Number(price || "0");

  const go = (to: number) => {
    setDirection(to > step ? "forward" : "back");
    setStep(to);
  };
  const canContinue = step !== 0 || Boolean(slot);
  const when = slot ? `${formatDay(new Date(slot.startsAt))} ${formatTime(new Date(slot.startsAt))}` : "";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-14 pb-8">
      <div className="flex items-center gap-3">
        {step === 0 ? (
          <Link href="/perfil/organizar" aria-label="Regresar" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink">
            <BackIcon />
          </Link>
        ) : (
          <button type="button" onClick={() => go(step - 1)} aria-label="Paso anterior" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface">
            <BackIcon />
          </button>
        )}
        <div aria-label={`Paso ${step + 1} de ${STEPS.length}`} className="flex flex-1 gap-1.5">
          {STEPS.map((name, i) => (
            <span key={name} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-action" : "bg-line"}`} />
          ))}
        </div>
        <Link href="/perfil/organizar" className="text-[15px] font-semibold text-muted">
          Salir
        </Link>
      </div>

      <div key={step} className={`flex flex-1 flex-col gap-5 pt-5 ${direction === "forward" ? "animate-slide-from-right" : "animate-slide-from-left"}`}>
        {step === 0 && (
          <>
            <Question kicker="Horario" title="¿Dónde y cuándo?" />
            <Group label="Cancha">
              <div className="-mr-4 flex gap-2 overflow-x-auto pr-4 [scrollbar-width:none]">
                {fields.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setFieldId(f.id);
                      setSlotId("");
                    }}
                    aria-pressed={f.id === fieldId}
                    className={`flex w-[132px] shrink-0 flex-col gap-1.5 rounded-[14px] border-[1.5px] bg-surface p-1.5 text-left ${f.id === fieldId ? "border-action" : "border-line"}`}
                  >
                    <span className="relative h-16 w-full overflow-hidden rounded-[9px]">
                      <Image src={coverSrc(f.cover_image)} alt="" fill sizes="132px" className="object-cover" />
                    </span>
                    <span className="flex flex-col px-1 pb-0.5">
                      <span className="truncate text-sm font-semibold">{f.name}</span>
                      <span className="text-xs text-muted">{f.area ?? ""}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Group>
            <Group label="Día">
              <div className="-mr-4 flex gap-1.5 overflow-x-auto pr-4 [scrollbar-width:none]">
                {days.map((d) => {
                  const key = dayKey(d);
                  const selected = key === day;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setDay(key);
                        setSlotId("");
                      }}
                      aria-pressed={selected}
                      className={`flex h-[50px] w-[46px] shrink-0 flex-col items-center justify-center rounded-xl ${selected ? "bg-action text-on-action" : "border border-line bg-surface"}`}
                    >
                      <span className="text-[10px] font-semibold uppercase opacity-80">
                        {d.toLocaleDateString("es-MX", { timeZone: TIME_ZONE, weekday: "short" }).replace(".", "")}
                      </span>
                      <span className="text-[17px] leading-tight font-medium">{d.toLocaleDateString("es-MX", { timeZone: TIME_ZONE, day: "numeric" })}</span>
                    </button>
                  );
                })}
              </div>
            </Group>
            <Group label="Horario disponible">
              {daySlots.length === 0 ? (
                <p className="text-sm text-muted">Esta cancha no tiene horarios publicados este día.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {daySlots.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        disabled={s.taken}
                        onClick={() => setSlotId(s.id)}
                        aria-pressed={s.id === slotId}
                        className={`h-11 rounded-xl text-[15px] ${
                          s.taken
                            ? "border border-dashed border-line text-muted line-through opacity-60"
                            : s.id === slotId
                              ? "bg-action font-semibold text-on-action"
                              : "border border-line bg-surface"
                        }`}
                      >
                        {formatTime(new Date(s.startsAt))}
                      </button>
                    ))}
                  </div>
                  {daySlots.some((s) => s.taken) && <span className="text-[13px] text-muted">Los tachados ya tienen reta.</span>}
                </>
              )}
            </Group>
          </>
        )}

        {step === 1 && (
          <>
            <Question kicker="Jugadores" title="¿Cuántos pueden jugar?" sub="Si no llegan al mínimo antes del cierre, la reta se cancela sola." />
            <div className="flex flex-col">
              <Stepper title="Mínimo" hint="para que se arme" value={min} onChange={(v) => setMin(Math.min(Math.max(2, v), max))} />
              <Stepper title="Máximo" hint="se llena con" value={max} onChange={(v) => setMax(Math.min(Math.max(min, v), 30))} />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Question kicker="Precio" title="¿Cuánto paga cada quien?" />
            <div className="flex flex-col items-center gap-2.5 pt-2">
              <span aria-live="polite" className="font-display text-[84px] leading-none font-medium tracking-tight">
                {pesos === 0 ? "Gratis" : `$${pesos}`}
              </span>
              <span className="text-[15px] text-muted">
                {pesos === 0 ? "Nadie paga por jugar" : `Juntas $${pesos * min} si se arma con ${min}`}
              </span>
              <button type="button" onClick={() => setPrice(pesos === 0 ? "80" : "0")} className="mt-1.5 flex h-[38px] items-center rounded-full border border-line px-4 text-[15px] font-semibold">
                {pesos === 0 ? "Ponerle precio" : "Hacerla gratis"}
              </button>
            </div>
            <div className="grid grid-cols-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key) =>
                key === "" ? (
                  <span key="blank" />
                ) : (
                  <button
                    key={key}
                    type="button"
                    aria-label={key === "⌫" ? "Borrar" : key}
                    onClick={() =>
                      setPrice((current) =>
                        key === "⌫" ? current.slice(0, -1) : current === "0" ? key : (current + key).slice(0, 4),
                      )
                    }
                    className="h-[52px] text-[24px]"
                  >
                    {key}
                  </button>
                ),
              )}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <Question kicker="La reta" title="¿Cómo se juega?" />
            <Chips label="Formato" options={FORMATS} value={format} onChange={setFormat} />
            <Chips label="Nivel" options={LEVELS} value={level} onChange={setLevel} />
            <Chips label="Tipo" options={TYPES} value={type} onChange={setType} />
          </>
        )}

        {step === 4 && slot && field && (
          <form id="publicar" action={action} className="flex flex-col gap-5">
            <Question kicker="Último paso" title="Revisa y publica" />
            <div className="flex flex-col divide-y divide-line rounded-[18px] border border-line bg-surface px-4">
              <Summary label="Cuándo" value={`${when}`} onEdit={() => go(0)} />
              <Summary label="Dónde" value={field.name} onEdit={() => go(0)} />
              <Summary label="Jugadores" value={`${min} a ${max}`} onEdit={() => go(1)} />
              <Summary label="Precio" value={pesos === 0 ? "Gratis" : `$${pesos}`} onEdit={() => go(2)} />
              <Summary label="Reta" value={`${label(FORMATS, format)} · ${label(LEVELS, level)} · ${label(TYPES, type)}`} onEdit={() => go(3)} />
              <div className="flex flex-col gap-2 py-3">
                <span className="text-[15px] text-muted">Cierre de inscripciones · horas antes de empezar</span>
                <div className="flex gap-2">
                  {closes.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setDeadlineHours(h)}
                      aria-pressed={h === hours}
                      className={`h-9 rounded-full px-3 text-sm font-semibold whitespace-nowrap ${h === hours ? "bg-action text-on-action" : "border border-line"}`}
                    >
                      {formatTime(new Date(new Date(slot.startsAt).getTime() - h * HOUR_MS))} · {h} h
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {extras ? (
              <div className="flex flex-col gap-3">
                <TextInput name="title" label="Título" placeholder={`Reta en ${field.name}`} />
                <TextInput name="description" label="Nota para los jugadores" placeholder="Trae playera clara y oscura" />
              </div>
            ) : (
              <button type="button" onClick={() => setExtras(true)} className="self-start text-[15px] font-semibold text-action">
                + Agregar título o una nota
              </button>
            )}

            {[
              ["slot_id", slot.id],
              ["min_players", min],
              ["max_players", max],
              ["price", pesos],
              ["format", format],
              ["level", level],
              ["type", type],
              ["deadline_hours", hours],
            ].map(([name, value]) => (
              <input key={name} type="hidden" name={String(name)} value={String(value)} />
            ))}
            <FieldError id="publicar-error">{state.error}</FieldError>
          </form>
        )}
      </div>

      <div className="flex flex-col gap-2.5 pt-4">
        {step === 0 && slot && field && (
          <span className="text-center text-sm text-muted">
            {field.name} · {when}–{formatTime(new Date(slot.endsAt))}
          </span>
        )}
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            disabled={!canContinue}
            onClick={() => go(step + 1)}
            className="h-[52px] rounded-full bg-action text-[17px] font-semibold text-on-action disabled:opacity-40"
          >
            Siguiente
          </button>
        ) : (
          <PublishButton />
        )}
      </div>
    </main>
  );
}

function PublishButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" form="publicar" disabled={pending} className="h-[52px] rounded-full bg-action text-[17px] font-semibold text-on-action disabled:opacity-60">
      {pending ? "Publicando…" : "Publicar reta"}
    </button>
  );
}

function Question({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-2 pt-1">
      <span className="text-sm font-semibold text-action">{kicker}</span>
      <h1 className="font-display text-[36px] leading-[1.02] font-medium tracking-tight">{title}</h1>
      {sub && <p className="text-[16px] leading-snug text-muted">{sub}</p>}
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      {children}
    </div>
  );
}

function Stepper({ title, hint, value, onChange }: { title: string; hint: string; value: number; onChange: (value: number) => void }) {
  const button = "flex size-[52px] items-center justify-center rounded-full border border-line text-[26px] font-light";
  return (
    <div className="flex items-center justify-between border-b border-line py-[18px]">
      <span className="flex flex-col gap-0.5">
        <span className="text-[17px] font-semibold">{title}</span>
        <span className="text-sm text-muted">{hint}</span>
      </span>
      <span className="flex items-center gap-4">
        <button type="button" onClick={() => onChange(value - 1)} aria-label={`Menos, ${title.toLowerCase()}`} className={button}>
          −
        </button>
        <span aria-live="polite" className="w-11 text-center font-display text-[34px] font-medium">
          {value}
        </span>
        <button type="button" onClick={() => onChange(value + 1)} aria-label={`Más, ${title.toLowerCase()}`} className={button}>
          +
        </button>
      </span>
    </div>
  );
}

function Chips({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (value: string) => void }) {
  return (
    <Group label={label}>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={option.value === value}
            className={`h-10 rounded-full px-4 text-[15px] font-semibold ${option.value === value ? "bg-action text-on-action" : "border border-line"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </Group>
  );
}

function Summary({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="text-[15px] text-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="truncate text-[16px] font-semibold">{value}</span>
        <button type="button" onClick={onEdit} className="text-sm font-semibold text-action">
          Editar
        </button>
      </span>
    </div>
  );
}

function TextInput({ name, label, placeholder }: { name: string; label: string; placeholder: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-[13px] font-semibold text-muted">
        {label} <span className="font-normal">· opcional</span>
      </label>
      <input
        id={name}
        name={name}
        placeholder={placeholder}
        maxLength={120}
        className="h-[50px] rounded-[14px] border border-line bg-surface px-4 text-[16px] text-ink placeholder:text-muted focus:ring-2 focus:ring-ink/40 focus:outline-none"
      />
    </div>
  );
}

function BackIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
