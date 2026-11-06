import Link from "next/link";
import type { ReactNode } from "react";

/** Bottom sheet over the page; the backdrop and `closeHref` return to the page without it. */
export function Sheet({ title, closeHref, children }: { title: ReactNode; closeHref: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 mx-auto max-w-md lg:max-w-none!">
      <Link href={closeHref} scroll={false} aria-label="Cerrar" className="absolute inset-0 animate-fade-in bg-black/60" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-titulo"
        className="absolute inset-x-0 bottom-0 flex animate-sheet-up max-h-[90dvh] flex-col gap-4 overflow-y-auto rounded-t-[10px] border-t border-line bg-surface px-5 pt-3 pb-8 lg:inset-x-auto lg:bottom-auto lg:top-1/2 lg:left-1/2 lg:w-[480px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:animate-fade-in lg:rounded-[8px] lg:border lg:border-line lg:pb-6 lg:shadow-[0_30px_60px_rgb(0_0_0/0.6)]"
      >
        <span aria-hidden="true" className="h-[5px] w-10 shrink-0 self-center rounded-[6px] bg-line lg:hidden" />
        <h2 id="sheet-titulo" className="font-display text-[28px] leading-none font-extrabold tracking-tight">
          {title}
        </h2>
        {children}
        <Link href={closeHref} scroll={false} className="flex h-11 shrink-0 items-center justify-center text-[15px] font-semibold text-muted">
          Cancelar
        </Link>
      </section>
    </div>
  );
}
