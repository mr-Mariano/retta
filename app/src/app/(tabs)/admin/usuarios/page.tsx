import type { Metadata } from "next";
import { requireRole } from "@/lib/roles";

export const metadata: Metadata = { title: "Usuarios · Retta" };

/** Admin users (flow B, 2026-11-04). Content comes in the next step. */
export default async function AdminUsuarios() {
  await requireRole(["admin"]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-[18px] px-4 pt-14 pb-32">
      <h1 className="font-display text-[34px] leading-none font-medium">Usuarios</h1>
    </main>
  );
}
