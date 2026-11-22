import Link from "next/link";
import type { Metadata } from "next";
import { AuthSplit } from "@/components/auth-split";
import { RecoveryForm } from "./recovery-form";

export const metadata: Metadata = { title: "Recupera tu contraseña · Retta" };

export default async function RecuperarContrasena({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthSplit>
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 pt-14 pb-8 md:py-10">
        <h1 className="font-display text-[34px] leading-none font-extrabold">Recupera tu contraseña</h1>
        {error === "link" && <p role="alert" className="text-sm text-danger">Tu sesión de recuperación venció. Solicita otro enlace.</p>}
        <RecoveryForm />
        <Link href="/entrar" className="text-sm font-semibold text-ink underline underline-offset-4">Volver a iniciar sesión</Link>
      </main>
    </AuthSplit>
  );
}
