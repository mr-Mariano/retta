import { Bone } from "@/components/skeleton";

export default function MatchLoading() {
  return (
    <main aria-busy="true" aria-label="Cargando" className="mx-auto min-h-dvh max-w-md">
      <Bone className="h-[280px] w-full rounded-none" />
      <div className="relative -mt-7 flex flex-col gap-4 rounded-t-3xl bg-base px-5 pt-5">
        <Bone className="h-6 w-24 rounded-full" />
        <Bone className="h-9 w-3/4 rounded-xl" />
        <Bone className="h-5 w-2/3 rounded-lg" />
        <Bone className="h-[120px] w-full" />
        <Bone className="h-12 w-full" />
      </div>
    </main>
  );
}
