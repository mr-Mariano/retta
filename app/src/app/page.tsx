import Image from "next/image";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-14">
      <Image src="/retta-wordmark.svg" alt="Retta" width={136} height={60} priority />
      <h1 className="font-display text-5xl leading-none font-extrabold">Encuentra tu reta</h1>
      <p className="text-muted">Inscríbete solo, sin armar equipo. Paga y juega.</p>
      <p className="text-sm text-muted">MVP en construcción.</p>
    </main>
  );
}
