import { authHref, authReturn } from "@/lib/auth-return";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthSplit } from "@/components/auth-split";
import { RegistroForm } from "./registro-form";

export const metadata: Metadata = { title: "Crea tu cuenta · Retta" };

export default async function Registro({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const destination = authReturn((await searchParams).next);
  return (
    <AuthSplit>
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-5 pt-14 pb-8 md:w-full md:py-10">
        <Link
          href="/"
          aria-label="Retta, volver al inicio"
          className="self-start md:hidden"
        >
          <Image
            src="/retta-wordmark.svg"
            alt=""
            width={68}
            height={30}
            className="h-[30px] w-auto"
          />
        </Link>
        <div className="flex items-end justify-between gap-2">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-[38px] leading-none font-extrabold tracking-tight">
              Encuentra tu reta
            </h1>
            <p className="text-[15px] leading-normal text-muted">
              Inscríbete solo, sin armar equipo. Paga y juega.
            </p>
          </div>
          <Image
            src="/mascota/saluda.png"
            alt="Silbato saludando"
            width={120}
            height={120}
            className="shrink-0"
          />
        </div>
        <RegistroForm destination={destination} />
        <p className="text-center text-[15px] text-muted">
          ¿Ya tienes cuenta?{" "}
          <Link href={authHref("/entrar", destination)} className="font-semibold text-ink">
            Inicia sesión
          </Link>
        </p>
      </main>
    </AuthSplit>
  );
}
