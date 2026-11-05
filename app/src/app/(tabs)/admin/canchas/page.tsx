import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/roles";
import { coverSrc } from "@/lib/covers";

export const metadata: Metadata = { title: "Canchas · Retta" };

/**
 * Admin fields, flow B (2026-11-04): a plain list with a round +. Each row
 * opens the field's agenda; a field whose manager lost that role shows "Asignar".
 */
export default async function AdminCanchas() {
  const { supabase } = await requireRole(["admin"]);
  const [{ data: fields }, { data: managers }] = await Promise.all([
    supabase.from("fields").select("id, name, cover_image, manager_id").order("name"),
    supabase.from("profiles").select("id, full_name").eq("role", "field_manager"),
  ]);
  const managerName = new Map((managers ?? []).map((m) => [m.id as string, m.full_name as string]));

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-[18px] px-4 pt-14 pb-32">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[34px] leading-none font-extrabold tracking-tight">Canchas</h1>
        <Link
          href="/admin/canchas/nueva"
          aria-label="Nueva cancha"
          className="flex size-[42px] items-center justify-center rounded-full bg-action text-on-action"
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </Link>
      </div>

      {(fields ?? []).length === 0 ? (
        <p className="py-8 text-center text-[15px] text-muted">Aún no hay canchas. Crea la primera con +.</p>
      ) : (
        <ul className="flex flex-col">
          {(fields ?? []).map((field) => {
            const manager = field.manager_id ? managerName.get(field.manager_id) : undefined;
            return (
              <li key={field.id}>
                <Link
                  href={`/canchas/${field.id}`}
                  className="flex items-center gap-3 border-b border-line py-3"
                >
                  <span className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-elevated">
                    <Image src={coverSrc(field.cover_image)} alt="" fill sizes="44px" className="object-cover" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[16px] font-semibold">{field.name}</span>
                    <span className="text-[13px] text-muted">{manager ?? "Sin responsable"}</span>
                  </span>
                  {manager ? (
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  ) : (
                    <span className="rounded-[6px] bg-action/15 px-2.5 py-[3px] text-xs font-semibold text-action">Asignar</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
