import { Bone } from "./skeleton";

/** Generic skeleton for screens with a back link, a title and a list (waiting feedback B). */
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <main aria-busy="true" aria-label="Cargando" className="mx-auto flex min-h-dvh max-w-md flex-col gap-[18px] px-4 pt-14 pb-10">
      <Bone className="size-10 rounded-full" />
      <Bone className="h-9 w-48 rounded-xl" />
      <Bone className="h-[140px] w-full rounded-[6px]" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Bone className="size-12 shrink-0 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Bone className="h-4 w-2/3 rounded-md" />
            <Bone className="h-3 w-1/3 rounded-md" />
          </div>
        </div>
      ))}
    </main>
  );
}
