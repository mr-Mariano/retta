import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/roles";
import { loadImpact } from "@/lib/agent/impact";
import { createImpactRepository } from "@/lib/agent/impact-repository";

export const metadata: Metadata = { title: "Agente Retta · Retta" };

export default async function AgenteImpacto() {
  const { supabase } = await requireRole(["admin"]);
  const { saved, notRescued, returning, played, scheduled } = await loadImpact(createImpactRepository(supabase), new Date());
  const line = "flex items-center gap-3 border-b border-line py-3.5";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-[18px] px-4 pt-14 pb-32">
      <Link href="/perfil" className="flex items-center gap-3 self-start text-[15px] font-semibold text-muted">
        <span className="flex size-10 items-center justify-center rounded-full border border-line bg-surface text-ink">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </span>
        Perfil
      </Link>

      <div className="flex flex-col items-center gap-1 pt-2">
        <p className="relative rounded-[6px] border border-line bg-surface px-[18px] py-3 text-center text-[18px] font-semibold">
          {saved === 0 ? "Esta semana aún no salvo retas" : saved === 1 ? "Esta semana salvé 1 reta" : `Esta semana salvé ${saved} retas`}
          <span aria-hidden="true" className="absolute -bottom-[8px] left-1/2 size-3.5 -translate-x-1/2 rotate-45 border-r border-b border-line bg-surface" />
        </p>
        <Image src="/mascota/celebra.png" alt="Silbato celebrando" width={180} height={180} priority />
      </div>

      <div className="-mt-2 flex flex-col items-center gap-0.5 text-center">
        <span className="font-display text-[56px] leading-none font-extrabold tracking-tight">
          {Math.round(played).toLocaleString("es-MX")} <span className="text-[24px]">min</span>
        </span>
        <span className="text-[15px] text-muted">de fútbol que sí se jugó</span>
        {scheduled > 0 && (
          <span className="text-[13px] text-muted">y {Math.round(scheduled).toLocaleString("es-MX")} min más por jugarse</span>
        )}
      </div>

      <div className="flex flex-col">
        <div className={line}>
          <span className="w-14 font-display text-[28px] leading-none font-extrabold tracking-tight text-action">{returning}</span>
          <span className="flex-1 text-[16px]">{returning === 1 ? "jugador volvió a jugar" : "jugadores volvieron a jugar"}</span>
        </div>
        <div className={line}>
          <span className="w-14 font-display text-[28px] leading-none font-extrabold tracking-tight text-danger">{notRescued}</span>
          <span className="flex-1 text-[16px]">{notRescued === 1 ? "reta no se salvó" : "retas no se salvaron"}</span>
        </div>
      </div>
    </main>
  );
}
