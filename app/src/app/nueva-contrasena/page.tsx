import Link from "next/link";
import type { Metadata } from "next";
import { AuthSplit } from "@/components/auth-split";
import { RECOVERY_REQUEST_PATH } from "@/lib/password-recovery";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = { title: "Elige una contraseña nueva · Retta" };

export default function NuevaContrasena() {
  return (
    <AuthSplit>
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 pt-14 pb-8 md:py-10">
        <h1 className="font-display text-[34px] leading-none font-extrabold">Elige una contraseña nueva</h1>
        <NewPasswordForm />
        <Link href={RECOVERY_REQUEST_PATH} className="text-sm font-semibold text-ink underline underline-offset-4">Solicitar otro enlace</Link>
      </main>
    </AuthSplit>
  );
}
