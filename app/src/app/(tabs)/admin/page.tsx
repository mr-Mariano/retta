import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/roles";

export const metadata: Metadata = { title: "Inicio · Retta" };

const AVATAR_COLORS = ["#2B3A66", "#4A2F5E", "#5E4A2F", "#2F5E4A"];

/** Admin home, "Tarjetas con foto" (option N1, 2026-11-04): Canchas and Retas as photo cards, Usuarios with stacked initials. */
export default async function AdminInicio() {
  const { supabase } = await requireRole(["admin"]);
  const [{ count: fields }, { data: users }, { count: matches }] = await Promise.all([
    supabase.from("fields").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("full_name").order("created_at"),
    supabase
      .from("matches")
      .select("id, slot:slots!inner(starts_at)", { count: "exact", head: true })
      .neq("status", "cancelled")
      .gt("slot.starts_at", new Date().toISOString()),
  ]);
  const people = users ?? [];
  const shown = people.slice(0, 4);
  const more = people.length - shown.length;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3.5 px-4 pt-14 pb-32">
      <h1 className="pb-1 font-display text-[34px] leading-none font-extrabold tracking-tight">Administrar</h1>

      <PhotoCard href="/admin/canchas" photo="foto-3" title="Canchas" sub="Crear y asignar responsable" value={fields ?? 0} />

      <Link href="/admin/usuarios" className="flex flex-col gap-3.5 rounded-[6px] border border-line bg-surface p-[18px]">
        <span className="flex items-end justify-between">
          <span className="flex flex-col gap-0.5">
            <span className="font-display text-[28px] leading-none font-extrabold tracking-tight">Usuarios</span>
            <span className="text-sm text-muted">Cambiar roles</span>
          </span>
          <span className="font-display text-[44px] leading-[0.9] font-extrabold tracking-tight">{people.length}</span>
        </span>
        <span aria-hidden="true" className="flex">
          {shown.map((person, i) => (
            <span
              key={i}
              style={{ background: AVATAR_COLORS[i] }}
              className={`flex size-11 items-center justify-center rounded-full border-[3px] border-surface text-sm font-semibold text-white ${i > 0 ? "-ml-3" : ""}`}
            >
              {initials(person.full_name as string)}
            </span>
          ))}
          {more > 0 && (
            <span className="-ml-3 flex size-11 items-center justify-center rounded-full border-[3px] border-surface bg-elevated text-sm font-semibold">
              +{more}
            </span>
          )}
        </span>
      </Link>

      <PhotoCard href="/admin/retas" photo="foto-1" title="Retas" sub="Ver y cancelar cualquier reta" value={matches ?? 0} />
    </main>
  );
}

function PhotoCard({ href, photo, title, sub, value }: { href: string; photo: string; title: string; sub: string; value: number }) {
  return (
    <Link href={href} className="relative block h-[158px] overflow-hidden rounded-[6px] text-white">
      <Image src={`/fotos/canchas/${photo}.jpg`} alt="" fill sizes="448px" className="object-cover" />
      <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgb(10_10_10/0.1),rgb(10_10_10/0.78))]" />
      <span className="absolute inset-x-[18px] bottom-4 flex items-end justify-between">
        <span className="flex flex-col gap-0.5">
          <span className="font-display text-[28px] leading-none font-extrabold tracking-tight">{title}</span>
          <span className="text-sm opacity-85">{sub}</span>
        </span>
        <span className="font-display text-[44px] leading-[0.9] font-extrabold tracking-tight">{value}</span>
      </span>
    </Link>
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
