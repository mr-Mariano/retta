import Image from "next/image";
import Link from "next/link";
import { AuthSplit, LiveMatchCard, headline, loadFeaturedMatch } from "@/components/auth-split";

export default async function Welcome() {
  const match = await loadFeaturedMatch();

  return (
    <AuthSplit>
      <main className="relative mx-auto flex min-h-dvh max-w-md flex-col overflow-hidden md:w-full">
        <div className="absolute inset-x-0 top-0 h-[520px] md:hidden">
          <Image src="/fotos/portada.jpg" alt="" fill priority sizes="448px" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/20 to-base" />
        </div>

        <div className="relative flex flex-1 flex-col gap-5 px-5 pt-14 pb-8 md:justify-center md:gap-4 md:px-8 md:py-0">
          <Image src="/retta-wordmark.svg" alt="Retta" width={59} height={26} priority className="h-[26px] w-auto self-start md:hidden" />

          {match && (
            <div className="mt-[150px] md:hidden">
              <LiveMatchCard match={match} />
            </div>
          )}

          <div className={`flex flex-col gap-2 md:hidden ${match ? "" : "mt-[230px]"}`}>
            <h1 className="font-display text-[42px] leading-none font-extrabold tracking-tight">{headline(match)}</h1>
            <p className="text-[15px] leading-normal text-muted">
              {match ? "Únete en un minuto y aparta tu lugar." : "Inscríbete solo, sin armar equipo. Paga y juega."}
            </p>
          </div>

          {/* Desktop (welcome A): the photo and live match sit on the left; this side only asks. */}
          <div className="hidden flex-col gap-2 md:flex">
            <h1 className="font-display text-[34px] leading-[1.05] font-extrabold tracking-tight">Juega esta semana</h1>
            <p className="text-[16px] text-muted">Crea tu cuenta para apartar tu lugar.</p>
          </div>

          <div className="mt-auto flex flex-col gap-2.5 md:mt-4">
            <Link
              href="/explorar"
              className="flex h-[52px] items-center justify-center rounded-[6px] bg-action text-[16px] font-bold text-on-action"
            >
              Explorar retas
            </Link>
            <p className="text-center text-[15px] text-muted">
              ¿Ya tienes cuenta?{" "}
              <Link href="/entrar" className="font-semibold text-ink">
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </main>
    </AuthSplit>
  );
}
