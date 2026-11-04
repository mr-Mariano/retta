import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/roles";
import { coverSrc } from "@/lib/covers";

export const metadata: Metadata = { title: "Tus canchas · Retta" };

interface FieldRow {
  id: string;
  name: string;
  area: string | null;
  cover_image: string;
  slots: { starts_at: string; matches: { status: string }[] }[];
}

export default async function Canchas() {
  const { supabase, user, role } = await requireRole(["field_manager", "admin"]);
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let query = supabase
    .from("fields")
    .select("id, name, area, cover_image, slots(starts_at, matches(status))")
    .gt("slots.starts_at", now.toISOString())
    .lt("slots.starts_at", weekEnd.toISOString())
    .order("name");
  if (role !== "admin") query = query.eq("manager_id", user.id);
  const { data: fields } = await query.returns<FieldRow[]>();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-[18px] px-4 pt-14 pb-28">
      <Link href="/perfil" className="flex items-center gap-3 self-start text-[15px] font-semibold text-muted">
        <span className="flex size-10 items-center justify-center rounded-full border border-line bg-surface text-ink">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </span>
        Perfil
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[34px] leading-none font-medium">Tus canchas</h1>
        <p className="text-[15px] text-muted">Publica horarios para que los organizadores armen retas.</p>
      </div>

      {(fields ?? []).length === 0 ? (
        <p className="py-8 text-center text-[15px] text-muted">Aún no tienes canchas asignadas. El admin las asigna.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {(fields ?? []).map((field) => {
            const booked = field.slots.filter((slot) => slot.matches.some((m) => m.status !== "cancelled")).length;
            const free = field.slots.length - booked;
            return (
              <li key={field.id}>
                <Link href={`/canchas/${field.id}`} className="flex gap-3 rounded-[18px] border border-line bg-surface p-2 text-ink">
                  <span className="relative size-[84px] shrink-0 overflow-hidden rounded-xl bg-elevated">
                    <Image src={coverSrc(field.cover_image)} alt="" fill sizes="84px" className="object-cover" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                    <span className="truncate font-display text-[21px] leading-none font-medium">{field.name}</span>
                    {field.area && <span className="text-[13px] text-muted">{field.area}</span>}
                    <span className="text-sm">
                      <span className="font-semibold text-action">{free} libres</span>
                      <span className="text-muted"> · {booked} con reta esta semana</span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
