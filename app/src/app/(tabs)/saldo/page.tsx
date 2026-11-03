import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { TIME_ZONE } from "@/lib/time";

export const metadata: Metadata = { title: "Saldo · Retta" };

interface TransactionRow {
  id: string;
  type: "charge" | "credit_used" | "credit_dropout" | "credit_cancellation";
  amount_cents: number;
  created_at: string;
  registration: {
    match: {
      title: string | null;
      cancel_reason: "minimum_not_reached" | "organizer" | "admin" | null;
      slot: { field: { name: string } };
    };
  };
}

/** "3 nov" */
function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { timeZone: TIME_ZONE, day: "numeric", month: "short" }).replace(".", "");
}

/** What happened, in plain words; credits use the accent dot, uses and test payments a grey one. */
function describe(row: TransactionRow) {
  const pesos = row.amount_cents / 100;
  switch (row.type) {
    case "credit_dropout":
      return { label: "Te diste de baja", note: null, amount: `+$${pesos}`, dot: "bg-action" };
    case "credit_cancellation":
      return {
        label: "Se canceló la reta",
        note: row.registration.match.cancel_reason === "minimum_not_reached" ? "no llegó al mínimo" : null,
        amount: `+$${pesos}`,
        dot: "bg-action",
      };
    case "credit_used":
      return { label: "Usaste saldo", note: null, amount: `−$${pesos}`, dot: "bg-muted" };
    case "charge":
      return { label: "Pago de prueba", note: "no afecta tu saldo", amount: `$${pesos}`, dot: "bg-line" };
  }
}

export default async function Saldo() {
  const supabase = await createClient();

  const [{ data: balanceCents }, { data: rows }] = await Promise.all([
    supabase.rpc("my_balance"),
    supabase
      .from("transactions")
      .select("id, type, amount_cents, created_at, registration:registrations!inner(match:matches!inner(title, cancel_reason, slot:slots!inner(field:fields!inner(name))))")
      .order("created_at", { ascending: false })
      .returns<TransactionRow[]>(),
  ]);
  const balance = Math.max(balanceCents ?? 0, 0) / 100;
  const history = rows ?? [];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-[18px] px-4 pt-14 pb-28">
      <h1 className="font-display text-[34px] leading-none font-medium">Saldo</h1>

      <div className="flex items-center justify-between gap-4 rounded-[18px] border border-line bg-surface p-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-muted">Disponible</span>
          <span className="font-display text-[46px] leading-none font-medium">${balance}</span>
        </div>
        <span className="max-w-[150px] text-right text-[13px] leading-snug text-muted">
          Se descuenta solo al inscribirte. No caduca.
        </span>
      </div>

      <h2 className="mt-1 font-display text-[21px] font-medium">Historial</h2>

      {history.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Image src="/mascota/espera.png" alt="" width={120} height={120} />
          <p className="max-w-[260px] text-[15px] text-muted">
            Aquí verás tus pagos y el saldo que recibas si te das de baja o se cancela una reta.
          </p>
          <Link href="/explorar" className="flex h-11 items-center rounded-full border border-line px-5 text-[15px] font-semibold text-ink">
            Buscar una reta
          </Link>
        </div>
      ) : (
        <ol className="flex flex-col">
          {history.map((row, i) => {
            const entry = describe(row);
            const match = row.registration.match;
            const last = i === history.length - 1;
            return (
              <li key={row.id} className="relative flex gap-3.5 pb-3.5">
                {!last && <span aria-hidden="true" className="absolute top-5 -bottom-0 left-[7px] w-0.5 bg-line" />}
                <span aria-hidden="true" className={`relative mt-[3px] size-4 shrink-0 rounded-full border-[3px] border-base ${entry.dot}`} />
                <div className="flex flex-1 justify-between gap-2.5">
                  <div className="flex min-w-0 flex-col gap-px">
                    <span className="text-[15px] font-semibold">{entry.label}</span>
                    <span className="text-[13px] text-muted">
                      {match.title ?? `Reta en ${match.slot.field.name}`} · {shortDate(row.created_at)}
                      {entry.note && ` · ${entry.note}`}
                    </span>
                  </div>
                  <span className={`text-[15px] font-semibold ${row.type === "charge" ? "text-muted" : ""}`}>{entry.amount}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

    </main>
  );
}
