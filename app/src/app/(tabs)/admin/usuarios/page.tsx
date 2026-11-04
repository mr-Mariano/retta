import type { Metadata } from "next";
import { Sheet } from "@/components/sheet";
import { ToastStack } from "@/components/toast-stack";
import { requireRole } from "@/lib/roles";
import { setRole } from "@/app/admin/actions";
import { ROLE_LABELS } from "@/lib/role-labels";
import { UserList, type UserRow } from "./user-list";

export const metadata: Metadata = { title: "Usuarios · Retta" };

const NOTICES: Record<string, string> = {
  rol: "Rol actualizado",
  propio: "No puedes cambiar tu propio rol",
  error: "No se pudo cambiar el rol",
};

/** Admin users, flow B (2026-11-04): search + list; tapping a person opens a sheet where tapping a role saves it. */
export default async function AdminUsuarios({ searchParams }: { searchParams: Promise<{ usuario?: string; aviso?: string }> }) {
  const [{ supabase, user: me }, { usuario, aviso }] = await Promise.all([requireRole(["admin"]), searchParams]);
  const { data } = await supabase.from("profiles").select("id, full_name, role").order("full_name");
  const users = (data ?? []) as UserRow[];
  const selected = usuario ? users.find((u) => u.id === usuario) : undefined;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-[18px] px-4 pt-14 pb-32">
      <h1 className="font-display text-[34px] leading-none font-medium">Usuarios</h1>
      <UserList users={users} />

      {selected && (
        <Sheet title={selected.full_name} closeHref="/admin/usuarios">
          {selected.id === me.id ? (
            <p className="text-[15px] text-muted">Eres tú. Otro admin puede cambiar tu rol.</p>
          ) : (
            <div role="radiogroup" aria-label="Rol" className="flex flex-col gap-2">
              {Object.entries(ROLE_LABELS).map(([role, label]) => {
                const current = role === selected.role;
                return (
                  <form key={role} action={setRole.bind(null, selected.id, role)}>
                    <button
                      type="submit"
                      role="radio"
                      aria-checked={current}
                      disabled={current}
                      className={`flex h-[52px] w-full items-center justify-between rounded-2xl bg-elevated px-4 text-left text-[16px] font-semibold ${current ? "border-[1.5px] border-action" : "border border-line"}`}
                    >
                      {label}
                      {current && (
                        <span className="flex size-[22px] items-center justify-center rounded-full bg-action text-on-action">
                          <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12.5l4.5 4.5L19 7.5" />
                          </svg>
                        </span>
                      )}
                    </button>
                  </form>
                );
              })}
            </div>
          )}
        </Sheet>
      )}
      <ToastStack key={aviso} toasts={aviso && NOTICES[aviso] ? [{ id: aviso, message: NOTICES[aviso] }] : []} clearParams={["aviso"]} />
    </main>
  );
}
