import { Bone } from "@/components/skeleton";

export default function TabsLoading() {
  return (
    <main aria-busy="true" aria-label="Cargando" className="mx-auto flex min-h-dvh max-w-md flex-col gap-[18px] px-4 pt-14 pb-28">
      <Bone className="h-4 w-24 rounded-[6px]" />
      <Bone className="h-9 w-56 rounded-xl" />
      <Bone className="h-10 w-full rounded-[6px]" />
      <Bone className="h-[200px] w-full rounded-[6px]" />
      <Bone className="h-[100px] w-full rounded-[6px]" />
      <Bone className="h-[100px] w-full rounded-[6px]" />
    </main>
  );
}
