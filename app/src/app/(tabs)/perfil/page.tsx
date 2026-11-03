import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { signOut } from "@/app/auth/actions";
import { Sheet } from "@/components/sheet";
import { FacebookIcon, InstagramIcon } from "@/components/social-icons";
import { ToastStack } from "@/components/toast-stack";
import { formatPhone, splitPhone } from "@/lib/phone-validation";
import { createClient } from "@/lib/supabase/server";
import { TIME_ZONE } from "@/lib/time";
import { NameForm, PhoneForm, SocialsForm } from "./edit-forms";

export const metadata: Metadata = { title: "Perfil · Retta" };

interface PlayedRow {
  attendance: "unrecorded" | "present" | "absent";
  match: { status: string; slot: { starts_at: string } };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export default async function Perfil({ searchParams }: { searchParams: Promise<{ editar?: string; aviso?: string }> }) {
  const { editar, aviso } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: socials }, { data: balanceCents }, { data: played }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, created_at").eq("id", user!.id).single(),
    supabase.rpc("my_socials"),
    supabase.rpc("my_balance"),
    supabase
      .from("registrations")
      .select("attendance, match:matches!inner(status, slot:slots!inner(starts_at))")
      .eq("player_id", user!.id)
      .eq("status", "active")
      .neq("match.status", "cancelled")
      .lt("match.slot.starts_at", new Date().toISOString())
      .returns<PlayedRow[]>(),
  ]);

  const name = profile?.full_name ?? "";
  const { instagram, facebook } = (socials ?? {}) as { instagram: string | null; facebook: string | null };
  const games = played ?? [];
  const marked = games.filter((g) => g.attendance !== "unrecorded");
  const attendance = marked.length ? `${Math.round((marked.filter((g) => g.attendance === "present").length / marked.length) * 100)}%` : "—";
  const since = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("es-MX", { timeZone: TIME_ZONE, month: "long", year: "numeric" })
    : "";
  const phone = splitPhone(profile?.phone ?? null);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-[18px] px-4 pt-14 pb-28">
      <div className="flex flex-col items-center gap-2.5 rounded-[20px] border border-line bg-surface px-4 py-5 text-center">
        <span aria-hidden="true" className="flex size-[72px] items-center justify-center rounded-full bg-action font-display text-[28px] font-medium text-on-action">
          {initials(name)}
        </span>
        <div className="flex flex-col gap-0.5">
          <h1 className="font-display text-[26px] leading-tight font-medium">{name}</h1>
          {since && <span className="text-sm text-muted">Jugador desde {since}</span>}
        </div>
        <dl className="mt-1.5 grid w-full grid-cols-3 border-t border-line pt-3.5">
          <Stat value={String(games.length)} label="retas jugadas" />
          <Stat value={attendance} label="asistencia" bordered />
          <Stat value={`$${Math.max(balanceCents ?? 0, 0) / 100}`} label="saldo" />
        </dl>
      </div>

      <Section title="Tu cuenta">
        <Row href="/perfil?editar=nombre" label="Nombre" value={name} />
        <Row href="/perfil?editar=telefono" label="Teléfono" value={formatPhone(profile?.phone ?? null) || "Agregar"} />
        <Row label="Correo" value={user!.email ?? ""} />
      </Section>

      <Section title="Tus redes" note="Solo las ven jugadores con quienes ya compartiste una reta.">
        <SocialRow icon={<InstagramIcon />} name="Instagram" value={instagram ? `@${instagram}` : null} />
        <SocialRow icon={<FacebookIcon />} name="Facebook" value={facebook} />
      </Section>

      <form action={signOut}>
        <button type="submit" className="flex h-12 w-full items-center justify-center rounded-full border border-line text-[16px] font-semibold text-ink">
          Cerrar sesión
        </button>
      </form>

      {editar === "nombre" && (
        <Sheet title="Tu nombre" closeHref="/perfil">
          <NameForm fullName={name} />
        </Sheet>
      )}
      {editar === "telefono" && (
        <Sheet title="Tu teléfono" closeHref="/perfil">
          <PhoneForm national={phone.national} country={phone.country} />
        </Sheet>
      )}
      {editar === "redes" && (
        <Sheet title="Tus redes" closeHref="/perfil">
          <SocialsForm instagram={instagram ?? ""} facebook={facebook ?? ""} />
        </Sheet>
      )}

      <ToastStack
        key={aviso}
        toasts={aviso === "guardado" ? [{ id: "guardado", message: "Cambios guardados" }] : []}
        clearParams={["aviso"]}
      />
    </main>
  );
}

function Stat({ value, label, bordered }: { value: string; label: string; bordered?: boolean }) {
  return (
    <div className={`flex flex-col-reverse gap-0.5 ${bordered ? "border-x border-line" : ""}`}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-display text-[24px] font-medium">{value}</dd>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[13px] font-semibold text-muted">{title}</h2>
      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">{children}</div>
      {note && <p className="text-[13px] leading-snug text-muted">{note}</p>}
    </section>
  );
}

function Chevron() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/** A settings row; without `href` it is read-only (the email cannot change here). */
function Row({ href, label, value }: { href?: string; label: string; value: string }) {
  const content = (
    <>
      <span className="text-[15px] text-muted">{label}</span>
      <span className="min-w-0 flex-1 truncate text-right text-[15px] font-semibold">{value}</span>
      {href && <Chevron />}
    </>
  );
  const className = "flex min-h-[52px] items-center gap-3 px-3.5 text-ink";
  return href ? (
    <Link href={href} scroll={false} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function SocialRow({ icon, name, value }: { icon: ReactNode; name: string; value: string | null }) {
  return (
    <Link href="/perfil?editar=redes" scroll={false} className="flex min-h-[52px] items-center gap-3 px-3.5 text-ink">
      <span className="text-muted">{icon}</span>
      <span className="flex-1 text-[15px]">{name}</span>
      {value ? (
        <>
          <span className="truncate text-[15px] font-semibold">{value}</span>
          <Chevron />
        </>
      ) : (
        <span className="flex h-8 items-center rounded-full bg-action px-3 text-sm font-semibold text-on-action">Vincular</span>
      )}
    </Link>
  );
}
