"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { FieldError } from "@/components/form";
import { BUNDLED_COVERS, FIELD_PHOTOS_BUCKET, coverSrc } from "@/lib/covers";
import { MAPBOX_TOKEN } from "@/lib/mapbox";
import { createClient } from "@/lib/supabase/client";
import { createField, type CreateFieldState } from "../../actions";
import { PendingButton } from "@/components/pending-button";

const STEPS = ["foto", "ubicacion", "responsable"] as const;
// Phone photos are resized before upload so they go up fast and load fast.
const MAX_SIDE = 1600;
// Guadalajara centre: where the map opens when there is no better guess.
const START = { lat: 20.6767, lng: -103.3475 };

interface Place {
  lat: number;
  lng: number;
  address: string;
  area: string;
}

/** New field, flow B (2026-11-04): name and photo, map pin, then manager and changing rooms. */
export function NewFieldFlow({ managers }: { managers: { id: string; full_name: string }[] }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [name, setName] = useState("");
  const [cover, setCover] = useState("");
  const [uploading, setUploading] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [managerId, setManagerId] = useState(managers.length === 1 ? managers[0]!.id : "");
  const [changingRooms, setChangingRooms] = useState(false);
  const [state, action] = useActionState<CreateFieldState, FormData>(createField, {});

  const go = (to: number) => {
    setDirection(to > step ? "forward" : "back");
    setStep(to);
  };
  const canContinue = step === 0 ? name.trim().length >= 3 && Boolean(cover) && !uploading : step === 1 ? Boolean(place?.address) : Boolean(managerId);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-14 pb-8">
      <div className="flex items-center gap-3">
        {step === 0 ? (
          <Link href="/admin/canchas" aria-label="Cerrar" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink">
            <CloseIcon />
          </Link>
        ) : (
          <button type="button" onClick={() => go(step - 1)} aria-label="Paso anterior" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface">
            <BackIcon />
          </button>
        )}
        <div aria-hidden="true" className="flex flex-1 gap-1.5">
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1 flex-1 rounded-[6px] transition-colors duration-300 ${i <= step ? "bg-action" : "bg-line"}`} />
          ))}
        </div>
        <span className="text-[13px] font-semibold text-muted">
          {step + 1}/{STEPS.length}
        </span>
      </div>

      <div key={step} className={`flex flex-1 flex-col gap-5 pt-6 ${direction === "forward" ? "animate-slide-from-right" : "animate-slide-from-left"}`}>
        {step === 0 && (
          <>
            <h1 className="font-display text-[32px] leading-[1.05] font-extrabold tracking-tight">¿Cómo se llama?</h1>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Cancha El Bajío"
              aria-label="Nombre de la cancha"
              maxLength={60}
              className="h-14 rounded-2xl border-[1.5px] border-line bg-surface px-4 text-[20px] focus:border-action focus:outline-none"
            />
            <PhotoPicker cover={cover} onCover={setCover} uploading={uploading} onUploading={setUploading} />
          </>
        )}

        {step === 1 && (
          <>
            <div className="flex flex-col gap-1.5">
              <h1 className="font-display text-[32px] leading-[1.05] font-extrabold tracking-tight">¿Dónde está?</h1>
              <p className="text-[15px] text-muted">Mueve el mapa; la dirección se llena sola.</p>
            </div>
            <PinMap place={place} onPlace={setPlace} />
          </>
        )}

        {step === 2 && (
          <form id="crear-cancha" action={action} className="flex flex-col gap-5">
            <h1 className="font-display text-[32px] leading-[1.05] font-extrabold tracking-tight">¿Quién la administra?</h1>
            <div role="radiogroup" aria-label="Responsable" className="flex flex-col gap-2">
              {managers.map((m) => {
                const selected = m.id === managerId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setManagerId(m.id)}
                    className={`flex items-center gap-3 rounded-2xl bg-surface px-3.5 py-3 text-left ${selected ? "border-[1.5px] border-action" : "border border-line"}`}
                  >
                    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-elevated text-[13px] font-semibold">
                      {initials(m.full_name)}
                    </span>
                    <span className="flex-1 text-[16px] font-semibold">{m.full_name}</span>
                    {selected && (
                      <span className="flex size-[22px] items-center justify-center rounded-full bg-action text-on-action">
                        <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
              {managers.length === 0 && (
                <p className="text-[15px] text-muted">No hay responsables de cancha. Cambia el rol de alguien en Usuarios.</p>
              )}
            </div>
            <label className="flex items-center justify-between px-0.5 py-1">
              <span className="text-[16px]">Tiene vestidores</span>
              <input
                type="checkbox"
                name="has_changing_rooms"
                checked={changingRooms}
                onChange={(event) => setChangingRooms(event.target.checked)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="relative h-[30px] w-[50px] rounded-full bg-line transition-colors peer-checked:bg-action peer-focus-visible:ring-2 peer-focus-visible:ring-ink/40 after:absolute after:top-[3px] after:left-[3px] after:size-6 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5"
              />
            </label>
            {[
              ["name", name.trim()],
              ["cover_image", cover],
              ["address", place?.address ?? ""],
              ["area", place?.area ?? ""],
              ["latitude", place?.lat ?? ""],
              ["longitude", place?.lng ?? ""],
              ["manager_id", managerId],
            ].map(([key, value]) => (
              <input key={key} type="hidden" name={String(key)} value={String(value)} />
            ))}
            <FieldError id="crear-cancha-error">{state.error}</FieldError>
          </form>
        )}
      </div>

      <div className="pt-4">
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            disabled={!canContinue}
            onClick={() => go(step + 1)}
            className="h-[52px] w-full rounded-[6px] bg-action text-[17px] font-semibold text-on-action disabled:opacity-40"
          >
            Siguiente
          </button>
        ) : (
          <CreateButton disabled={!canContinue} />
        )}
      </div>
    </main>
  );
}

/** "Tomar foto o elegir de la galería" (one input: phones offer camera and gallery), or a bundled cover. */
function PhotoPicker({
  cover,
  onCover,
  uploading,
  onUploading,
}: {
  cover: string;
  onCover: (cover: string) => void;
  uploading: boolean;
  onUploading: (uploading: boolean) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const uploaded = cover.startsWith("http");

  async function pick(file: File | undefined) {
    if (!file) return;
    setError("");
    setPreview(URL.createObjectURL(file));
    onUploading(true);
    try {
      const blob = await shrink(file);
      const path = `${crypto.randomUUID()}.jpg`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage.from(FIELD_PHOTOS_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
      if (uploadError) throw uploadError;
      onCover(supabase.storage.from(FIELD_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl);
    } catch {
      setPreview(null);
      setError("No se pudo subir la foto. Intenta otra vez.");
    } finally {
      onUploading(false);
    }
  }

  const shown = preview ?? (uploaded ? cover : null);

  return (
    <div className="flex flex-col gap-3">
      <label
        className={`relative flex h-[200px] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-[6px] ${
          shown ? "" : "border-[1.5px] border-dashed border-action bg-action/10 text-action"
        }`}
      >
        <input type="file" accept="image/*" className="sr-only" onChange={(event) => pick(event.target.files?.[0])} />
        {shown ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the picked file */}
            <img src={shown} alt="Foto de la cancha" className="absolute inset-0 size-full object-cover" />
            {uploading ? (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 text-white">
                <span aria-hidden="true" className="agent-spin size-7 rounded-full border-[3px] border-white/30 border-t-white" />
                <span className="text-sm font-semibold">Subiendo foto…</span>
              </span>
            ) : (
              <span className="absolute top-3 right-3 rounded-[6px] bg-black/60 px-3 py-1 text-xs font-semibold text-white">Cambiar</span>
            )}
          </>
        ) : (
          <>
            <svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            <span className="text-[16px] font-semibold">Tomar foto o elegir de la galería</span>
          </>
        )}
      </label>
      <FieldError id="foto-error">{error}</FieldError>
      <span className="text-[13px] font-semibold text-muted">O elige una del set</span>
      <div className="grid grid-cols-6 gap-1.5">
        {BUNDLED_COVERS.map((c) => (
          <button
            key={c}
            type="button"
            disabled={uploading}
            onClick={() => {
              setPreview(null);
              onCover(c);
            }}
            aria-pressed={cover === c}
            aria-label={`Foto ${c.slice(-1)} del set`}
            className={`relative aspect-square overflow-hidden rounded-lg border-2 ${cover === c ? "border-action" : "border-transparent"}`}
          >
            <Image src={coverSrc(c)} alt="" fill sizes="60px" className="object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Downscales a photo to at most MAX_SIDE px and re-encodes it as JPEG. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode"))), "image/jpeg", 0.82));
}

function CreateButton({ disabled }: { disabled: boolean }) {
  return (
    <PendingButton form="crear-cancha" pendingLabel="Creando cancha…" disabled={disabled} className="h-[52px] w-full rounded-[6px] bg-action text-[17px] font-semibold text-on-action">
      Crear cancha
    </PendingButton>
  );
}

/** Full-width map with a fixed centre pin; where the map stops becomes the field's address. */
function PinMap({ place, onPlace }: { place: Place | null; onPlace: (place: Place) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapboxMap | null>(null);
  const [looking, setLooking] = useState(false);
  const onPlaceRef = useRef(onPlace);
  onPlaceRef.current = onPlace;
  const initial = useRef(place ?? START);

  useEffect(() => {
    let cancelled = false;
    let request = 0;

    async function lookup(lat: number, lng: number) {
      const id = ++request;
      setLooking(true);
      try {
        const response = await fetch(
          `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lng}&latitude=${lat}&language=es&types=address,street&access_token=${MAPBOX_TOKEN}`,
        );
        const feature = (await response.json()).features?.[0]?.properties;
        if (id !== request || cancelled) return;
        const context = feature?.context ?? {};
        onPlaceRef.current({
          lat,
          lng,
          address: feature?.full_address ?? feature?.name ?? "",
          area: context.neighborhood?.name ?? context.locality?.name ?? context.place?.name ?? "",
        });
      } catch {
        if (id === request && !cancelled) onPlaceRef.current({ lat, lng, address: "", area: "" });
      } finally {
        if (id === request && !cancelled) setLooking(false);
      }
    }

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelled || !container.current) return;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const instance = new mapboxgl.Map({
        container: container.current,
        style: dark ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11",
        center: [initial.current.lng, initial.current.lat],
        zoom: 15,
      });
      const report = () => {
        const center = instance.getCenter();
        void lookup(center.lat, center.lng);
      };
      instance.on("load", report);
      instance.on("moveend", report);
      map.current = instance;
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  return (
    <div className="relative -mx-4 min-h-[420px] flex-1 overflow-hidden bg-elevated">
      {/* mapbox-gl.css makes the map container position: relative, so it sits inside a sized box. */}
      <div className="absolute inset-0">
        <div ref={container} className="size-full" />
      </div>
      <svg
        aria-hidden="true"
        width="52"
        height="68"
        viewBox="0 0 52 68"
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full drop-shadow-lg"
      >
        <path d="M26 2C12.7 2 2 12.5 2 25.6 2 43.2 26 66 26 66s24-22.8 24-40.4C50 12.5 39.3 2 26 2z" className="fill-action" stroke="#fff" strokeWidth="3" />
        <circle cx="26" cy="25" r="8" fill="#fff" />
      </svg>
      <div className="absolute inset-x-4 bottom-10 flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 py-3">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-action">
          <path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
        <span aria-live="polite" className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-semibold">{looking ? "Buscando dirección…" : place?.address || "Mueve el mapa"}</span>
          {place?.area && !looking && <span className="truncate text-[13px] text-muted">{place.area}</span>}
        </span>
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function BackIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
