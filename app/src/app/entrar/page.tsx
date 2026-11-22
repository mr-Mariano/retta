import { authHref, authReturn } from "@/lib/auth-return";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthSplit } from "@/components/auth-split";
import { EntrarForm } from "./entrar-form";

export const metadata: Metadata = { title: "Inicia sesión · Retta" };

export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const destination = authReturn(next);

  return (
    <AuthSplit>
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-7 px-5 pt-14 pb-8 md:w-full md:py-10">
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
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-[38px] leading-none font-extrabold tracking-tight">
            Hola de nuevo
          </h1>
          <p className="text-[15px] leading-normal text-muted">
            Entra para ver tus retas y tu saldo.
          </p>
        </div>
        <EntrarForm destination={destination}
          initialError={
            error === "link"
              ? "El enlace ya no es válido. Inicia sesión con tu correo."
              : undefined
          }
        />
        <p className="text-center text-[15px] text-muted">
          ¿Aún no tienes cuenta?{" "}
          <Link href={authHref("/registro", destination)} className="font-semibold text-ink">
            Crea una
          </Link>
        </p>
      </main>
    </AuthSplit>
  );
}
