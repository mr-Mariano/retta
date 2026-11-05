import Link from "next/link";
import type { ReactNode } from "react";

/** Bottom sheet over the page; the backdrop and `closeHref` return to the page without it. */
export function Sheet({ title, closeHref, children }: { title: ReactNode; closeHref: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 mx-auto max-w-md">
      <Link href={closeHref} scroll={false} aria-label="Cerrar" className="absolute inset-0 animate-fade-in bg-black/60" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-titulo"
        className="absolute inset-x-0 bottom-0 flex animate-sheet-up max-h-[90dvh] flex-col gap-4 overflow-y-auto rounded-t-[10px] border-t border-line bg-surface px-5 pt-3 pb-8"
      >
        <span aria-hidden="true" className="h-[5px] w-10 shrink-0 self-center rounded-[6px] bg-line" />
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
