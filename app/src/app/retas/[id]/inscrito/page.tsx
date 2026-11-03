import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatLongDay, formatTime, relativeDay } from "@/lib/time";

export const metadata: Metadata = { title: "¡Estás dentro! · Retta" };

interface Registration {
  id: string;
  match: {
    min_players: number;
    status: "pending" | "confirmed" | "cancelled";
    slot: { starts_at: string; field: { name: string } };
  };
  transactions: { type: "charge" | "credit_used"; amount_cents: number }[];
}

/** "el miércoles 4 de noviembre", "hoy" or "mañana" */
function whenPhrase(date: Date) {
  const relative = relativeDay(date);
  return relative ? relative.toLowerCase() : `el ${formatLongDay(date).toLowerCase()}`;
}

/** Sign-up success (J05). `armada=1` means this sign-up reached the minimum. */
export default async function SignedUp({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ armada?: string }>;
}) {
  const [{ id }, { armada }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: registration } = await supabase
    .from("registrations")
    .select(
      "id, match:matches!inner(min_players, status, slot:slots!inner(starts_at, field:fields!inner(name))), transactions(type, amount_cents)",
    )
    .eq("match_id", id)
    .eq("player_id", user!.id)
    .eq("status", "active")
    .returns<Registration[]>()
    .maybeSingle();

  if (!registration) notFound();

  const { match } = registration;
  const startsAt = new Date(match.slot.starts_at);
  const justConfirmed = armada === "1" && match.status === "confirmed";
  const sum = (type: "charge" | "credit_used") =>
    registration.transactions.filter((t) => t.type === type).reduce((total, t) => total + t.amount_cents, 0) / 100;
  const charged = sum("charge");
  const credit = sum("credit_used");
  const meetUp = `Nos vemos ${whenPhrase(startsAt)} a las ${formatTime(startsAt)} en ${match.slot.field.name}.`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center gap-[18px] px-6 pt-[72px] pb-8 text-center">
      <Image src="/mascota/celebra.png" alt="" width={230} height={230} priority />
      <h1 className="font-display text-[45px] leading-none font-medium">
        {justConfirmed ? "¡Ya se armó la reta!" : "¡Estás dentro!"}
      </h1>
      <p className="max-w-[320px] text-[16px] leading-normal text-muted">
        {justConfirmed ? `Con tu lugar llegaron al mínimo de ${match.min_players}. ${meetUp}` : meetUp}
      </p>
      <div className="flex w-full justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-sm">
        {charged === 0 && credit === 0 ? (
          <span className="text-muted">Reta gratis</span>
        ) : (
          <>
            <span className="text-muted">{charged > 0 ? `Pagaste $${charged} (prueba)` : "Sin cargo"}</span>
            {credit > 0 && <span>Usaste ${credit} de saldo</span>}
          </>
        )}
      </div>
      <div className="mt-auto flex w-full flex-col gap-3">
        <Link
          href={`/retas/${id}`}
          className="flex h-[52px] items-center justify-center rounded-full bg-action text-[17px] font-bold text-on-action"
        >
          Ver mi reta
        </Link>
        <Link
          href="/explorar"
          className="flex h-[52px] items-center justify-center rounded-full border border-line text-[17px] font-bold text-ink"
        >
          Seguir explorando
        </Link>
      </div>
    </main>
  );
}
