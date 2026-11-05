import type { Metadata } from "next";
import { Sheet } from "@/components/sheet";
import { requireRole } from "@/lib/roles";
import { RoleOptions } from "./role-options";
import { UserList, type UserRow } from "./user-list";

export const metadata: Metadata = { title: "Usuarios · Retta" };

/** Admin users, flow B (2026-11-04): search + list; tapping a person opens a sheet where tapping a role saves it. */
export default async function AdminUsuarios({ searchParams }: { searchParams: Promise<{ usuario?: string }> }) {
  const [{ supabase, user: me }, { usuario }] = await Promise.all([requireRole(["admin"]), searchParams]);
  const { data } = await supabase.from("profiles").select("id, full_name, role").order("full_name");
  const users = (data ?? []) as UserRow[];
  const selected = usuario ? users.find((u) => u.id === usuario) : undefined;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-[18px] px-4 pt-14 pb-32">
      <h1 className="font-display text-[34px] leading-none font-extrabold tracking-tight">Usuarios</h1>
      <UserList users={users} />

      {selected && (
        <Sheet title={selected.full_name} closeHref="/admin/usuarios">
          {selected.id === me.id ? (
            <p className="text-[15px] text-muted">Eres tú. Otro admin puede cambiar tu rol.</p>
          ) : (
            <RoleOptions key={selected.id} userId={selected.id} role={selected.role} />
          )}
        </Sheet>
      )}
    </main>
  );
}
