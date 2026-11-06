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

export default async function Perfil({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string; aviso?: string; seccion?: string }>;
}) {
  const { editar, aviso, seccion } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: profile },
    { data: socials },
    { data: balanceCents },
    { data: played },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, created_at, role")
      .eq("id", user!.id)
      .single(),
    supabase.rpc("my_socials"),
    supabase.rpc("my_balance"),
    supabase
      .from("registrations")
      .select(
        "attendance, match:matches!inner(status, slot:slots!inner(starts_at))",
      )
      .eq("player_id", user!.id)
      .eq("status", "active")
      .neq("match.status", "cancelled")
      .lt("match.slot.starts_at", new Date().toISOString())
      .returns<PlayedRow[]>(),
  ]);

  const name = profile?.full_name ?? "";
  const { instagram, facebook } = (socials ?? {}) as {
    instagram: string | null;
    facebook: string | null;
  };
  const games = played ?? [];
  const marked = games.filter((g) => g.attendance !== "unrecorded");
  const attendance = marked.length
    ? `${Math.round((marked.filter((g) => g.attendance === "present").length / marked.length) * 100)}%`
    : "—";
  const since = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("es-MX", {
        timeZone: TIME_ZONE,
        month: "long",
        year: "numeric",
      })
    : "";
  const phone = splitPhone(profile?.phone ?? null);

  // Desktop (Perfil A, 2026-11-06): settings with a section menu on the left.
  const role = profile?.role ?? "player";
  const sections = [
    { key: "cuenta", label: "Cuenta" },
    { key: "redes", label: "Redes" },
    ...(role !== "player"
      ? [{ key: "herramientas", label: "Herramientas" }]
      : []),
    ...(role === "admin" ? [{ key: "agente", label: "Agente Retta" }] : []),
    { key: "sesion", label: "Sesión" },
  ];
  const current =
    sections.find((item) => item.key === seccion)?.key ?? "cuenta";

  return (
    <>
      <main className="mx-auto hidden min-h-dvh max-w-[980px] flex-col gap-[26px] px-4 pt-10 pb-12 lg:flex">
        <div className="flex items-center gap-[18px]">
          <span
            aria-hidden="true"
            className="flex size-16 items-center justify-center rounded-full bg-action text-[22px] font-extrabold text-on-action"
          >
            {initials(name)}
          </span>
          <span className="flex flex-col gap-0.5">
            <h1 className="text-[34px] leading-none font-extrabold tracking-tight">
              {name}
            </h1>
            <span className="text-sm text-muted">
              {since ? `Jugador desde ${since}` : ""} · {games.length} retas
              jugadas · asistencia {attendance}
            </span>
          </span>
        </div>
        <div className="flex gap-10">
          <nav
            aria-label="Secciones del perfil"
            className="flex w-[200px] shrink-0 flex-col gap-0.5"
          >
            {sections.map((item) => (
              <Link
                key={item.key}
                href={
                  item.key === "cuenta"
                    ? "/perfil"
                    : `/perfil?seccion=${item.key}`
                }
                scroll={false}
                aria-current={item.key === current ? "page" : undefined}
                className={`rounded-[4px] px-3 py-2.5 text-[15px] ${item.key === current ? "bg-surface font-bold" : "font-medium text-ink/80 hover:bg-surface/60"}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-1 flex-col">
            {current === "cuenta" && (
              <>
                <DeskTitle>Cuenta</DeskTitle>
                <DeskRow
                  label="Nombre"
                  value={name}
                  href="/perfil?editar=nombre"
                />
                <DeskRow
                  label="Teléfono"
                  value={formatPhone(profile?.phone ?? null) || "Agregar"}
                  href="/perfil?editar=telefono"
                />
                <DeskRow label="Correo" value={user!.email ?? ""} />
                <DeskRow
                  label="Saldo"
                  value={`$${Math.max(balanceCents ?? 0, 0) / 100}`}
                  href="/saldo"
                  action="Ver"
                />
              </>
            )}
            {current === "redes" && (
              <>
                <DeskTitle>Redes</DeskTitle>
                <DeskRow
                  label="Instagram"
                  value={instagram ? `@${instagram}` : "Sin vincular"}
                  href="/perfil?seccion=redes&editar=redes"
                  action={instagram ? "Editar" : "Vincular"}
                />
                <DeskRow
                  label="Facebook"
                  value={facebook ?? "Sin vincular"}
                  href="/perfil?seccion=redes&editar=redes"
                  action={facebook ? "Editar" : "Vincular"}
                />
                <p className="pt-3 text-[13px] text-muted">
                  Solo las ven jugadores con quienes ya compartiste una reta.
                </p>
              </>
            )}
            {current === "herramientas" && (
              <>
                <DeskTitle>Herramientas</DeskTitle>
                {(role === "organizer" || role === "admin") && (
                  <DeskRow
                    label="Organizar retas"
                    value="Tus retas"
                    href="/perfil/organizar"
                    action="Abrir"
                  />
                )}
                {(role === "field_manager" || role === "admin") && (
                  <DeskRow
                    label="Horarios de cancha"
                    value="Tus canchas"
                    href="/perfil/canchas"
                    action="Abrir"
                  />
                )}
              </>
            )}
            {current === "agente" && (
              <>
                <DeskTitle>Agente Retta</DeskTitle>
                <DeskRow
                  label="Impacto"
                  value="Retas salvadas y minutos jugados"
                  href="/perfil/agente"
                  action="Abrir"
                />
              </>
            )}
            {current === "sesion" && (
              <>
                <DeskTitle>Sesión</DeskTitle>
                <form action={signOut} className="pt-2">
                  <button
                    type="submit"
                    className="pending-button h-11 rounded-[4px] border border-line px-5 text-[15px] font-semibold"
                  >
                    Cerrar sesión
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>

      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-[18px] px-4 pt-14 pb-28 lg:hidden">
        <div className="flex flex-col items-center gap-2.5 rounded-[6px] border border-line bg-surface px-4 py-5 text-center">
          <span
            aria-hidden="true"
            className="flex size-[72px] items-center justify-center rounded-full bg-action font-display text-[28px] font-extrabold tracking-tight text-on-action"
          >
            {initials(name)}
          </span>
          <div className="flex flex-col gap-0.5">
            <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight">
              {name}
            </h1>
            {since && (
              <span className="text-sm text-muted">Jugador desde {since}</span>
            )}
          </div>
          <dl className="mt-1.5 grid w-full grid-cols-3 border-t border-line pt-3.5">
            <Stat value={String(games.length)} label="retas jugadas" />
            <Stat value={attendance} label="asistencia" bordered />
            <Stat
              value={`$${Math.max(balanceCents ?? 0, 0) / 100}`}
              label="saldo"
            />
          </dl>
        </div>

        <Section title="Tu cuenta">
          <Row href="/perfil?editar=nombre" label="Nombre" value={name} />
          <Row
            href="/perfil?editar=telefono"
            label="Teléfono"
            value={formatPhone(profile?.phone ?? null) || "Agregar"}
          />
          <Row label="Correo" value={user!.email ?? ""} />
        </Section>

        <Section
          title="Tus redes"
          note="Solo las ven jugadores con quienes ya compartiste una reta."
        >
          <SocialRow
            icon={<InstagramIcon />}
            name="Instagram"
            value={instagram ? `@${instagram}` : null}
          />
          <SocialRow icon={<FacebookIcon />} name="Facebook" value={facebook} />
        </Section>

        {profile?.role && profile.role !== "player" && (
          <Section title="Herramientas">
            {(profile.role === "organizer" || profile.role === "admin") && (
              <Row
                href="/perfil/organizar"
                label="Organizar retas"
                value="Tus retas"
              />
            )}
            {(profile.role === "field_manager" || profile.role === "admin") && (
              <Row
                href="/perfil/canchas"
                label="Horarios de cancha"
                value="Tus canchas"
              />
            )}
            {profile.role === "admin" && (
              <Row href="/perfil/agente" label="Agente Retta" value="Impacto" />
            )}
          </Section>
        )}

        <form action={signOut}>
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center rounded-[6px] border border-line text-[16px] font-semibold text-ink"
          >
            Cerrar sesión
          </button>
        </form>
      </main>

      {editar === "nombre" && (
        <Sheet
          title="Tu nombre"
          closeHref={
            current === "cuenta" ? "/perfil" : `/perfil?seccion=${current}`
          }
        >
          <NameForm fullName={name} />
        </Sheet>
      )}
      {editar === "telefono" && (
        <Sheet
          title="Tu teléfono"
          closeHref={
            current === "cuenta" ? "/perfil" : `/perfil?seccion=${current}`
          }
        >
          <PhoneForm national={phone.national} country={phone.country} />
        </Sheet>
      )}
      {editar === "redes" && (
        <Sheet
          title="Tus redes"
          closeHref={
            current === "cuenta" ? "/perfil" : `/perfil?seccion=${current}`
          }
        >
          <SocialsForm instagram={instagram ?? ""} facebook={facebook ?? ""} />
        </Sheet>
      )}

      <ToastStack
        key={aviso}
        toasts={
          aviso === "guardado"
            ? [{ id: "guardado", message: "Cambios guardados" }]
            : []
        }
        clearParams={["aviso"]}
      />
    </>
  );
}

function DeskTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="pb-1 text-xs font-bold tracking-[0.04em] text-muted uppercase">
      {children}
    </h2>
  );
}

function DeskRow({
  label,
  value,
  href,
  action = "Editar",
}: {
  label: string;
  value: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="flex items-center border-b border-line py-4">
      <span className="w-40 shrink-0 text-sm text-muted">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">
        {value}
      </span>
      {href && (
        <Link
          href={href}
          scroll={false}
          className="text-sm font-semibold text-muted hover:text-ink"
        >
          {action}
        </Link>
      )}
    </div>
  );
}

function Stat({
  value,
  label,
  bordered,
}: {
  value: string;
  label: string;
  bordered?: boolean;
}) {
  return (
    <div
      className={`flex flex-col-reverse gap-0.5 ${bordered ? "border-x border-line" : ""}`}
    >
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-display text-[24px] font-extrabold tracking-tight">
        {value}
      </dd>
    </div>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[13px] font-semibold text-muted">{title}</h2>
      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {children}
      </div>
      {note && <p className="text-[13px] leading-snug text-muted">{note}</p>}
    </section>
  );
}

function Chevron() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-muted"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/** A settings row; without `href` it is read-only (the email cannot change here). */
function Row({
  href,
  label,
  value,
}: {
  href?: string;
  label: string;
  value: string;
}) {
  const content = (
    <>
      <span className="text-[15px] text-muted">{label}</span>
      <span className="min-w-0 flex-1 truncate text-right text-[15px] font-semibold">
        {value}
      </span>
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

function SocialRow({
  icon,
  name,
  value,
}: {
  icon: ReactNode;
  name: string;
  value: string | null;
}) {
  return (
    <Link
      href="/perfil?editar=redes"
      scroll={false}
      className="flex min-h-[52px] items-center gap-3 px-3.5 text-ink"
    >
      <span className="text-muted">{icon}</span>
      <span className="flex-1 text-[15px]">{name}</span>
      {value ? (
        <>
          <span className="truncate text-[15px] font-semibold">{value}</span>
          <Chevron />
        </>
      ) : (
        <span className="flex h-8 items-center rounded-[6px] bg-action px-3 text-sm font-semibold text-on-action">
          Vincular
        </span>
      )}
    </Link>
  );
}
