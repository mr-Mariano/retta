import Link from "next/link";
import type { Metadata } from "next";
import { loadManagedField } from "../../field-data";
import { PublishForm } from "./publish-form";

export const metadata: Metadata = { title: "Publicar horarios · Retta" };

export default async function Publicar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { field } = await loadManagedField(id);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 pt-14 pb-8 lg:max-w-[1000px]! lg:gap-3 lg:pt-10">
      <Link href={`/canchas/${field.id}`} className="flex items-center gap-3 self-start text-[15px] font-semibold text-muted lg:text-sm lg:font-normal lg:hover:text-ink">
        <span className="flex size-10 lg:hidden! items-center justify-center rounded-full border border-line bg-surface text-ink">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </span>
        {field.name}
      </Link>
      <h1 className="font-display text-[32px] leading-[1.05] font-extrabold tracking-tight lg:text-[40px] lg:leading-none">Publicar horarios</h1>
      <PublishForm fieldId={field.id} />
    </main>
  );
}
