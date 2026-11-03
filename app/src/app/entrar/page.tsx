import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { GoogleButton } from "@/components/google-button";
import { EntrarForm } from "./entrar-form";

export const metadata: Metadata = { title: "Inicia sesión · Retta" };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-7 px-5 pt-14 pb-8">
      <Link href="/" aria-label="Retta, volver al inicio" className="self-start">
        <Image src="/retta-wordmark.svg" alt="" width={68} height={30} className="h-[30px] w-auto" />
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[44px] leading-[0.95] font-extrabold">Hola de nuevo</h1>
        <p className="text-[15px] leading-normal text-muted">Entra para ver tus retas y tu saldo.</p>
      </div>
      <div className="flex flex-col gap-4">
        <GoogleButton variant="secondary" />
        <div className="flex items-center gap-3 text-[13px] text-muted">
          <span className="h-px flex-1 bg-line" />o con tu correo<span className="h-px flex-1 bg-line" />
        </div>
      </div>
      <EntrarForm initialError={error === "google" ? "No pudimos entrar con Google. Inténtalo de nuevo." : undefined} />
      <p className="text-center text-[15px] text-muted">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/" className="font-semibold text-ink">
          Crea una
        </Link>
      </p>
    </main>
  );
}
