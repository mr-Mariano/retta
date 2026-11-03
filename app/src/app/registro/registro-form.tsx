"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpWithEmail, type SignUpState } from "@/app/auth/actions";
import { FormMessage, SubmitButton, TextField } from "@/components/form";
import { PhoneField } from "@/components/phone-field";

export function RegistroForm() {
  const [state, action] = useActionState<SignUpState, FormData>(signUpWithEmail, {});
  const { errors, values } = state;

  if (state.checkEmail) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5" role="status">
        <h2 className="font-display text-3xl leading-none font-extrabold">Revisa tu correo</h2>
        <p className="text-[15px] leading-normal text-muted">
          Te mandamos un enlace a <span className="font-semibold text-ink">{values?.email}</span> para confirmar tu cuenta. Ábrelo desde este dispositivo.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3.5" noValidate>
      <TextField id="full_name" name="full_name" label="Nombre completo" autoComplete="name" defaultValue={values?.fullName} error={errors?.fullName} />
      <TextField
        id="email"
        name="email"
        type="email"
        label="Correo"
        autoComplete="email"
        defaultValue={values?.email}
        error={
          errors?.email === "Ya hay una cuenta con este correo." ? (
            <>
              {errors.email}{" "}
              <Link href="/entrar" className="font-semibold text-ink">
                Inicia sesión
              </Link>
            </>
          ) : (
            errors?.email
          )
        }
      />
      <PhoneField
        hint="Para que el organizador te recuerde la reta por WhatsApp."
        defaultValue={values?.phone}
        defaultCountry={values?.country}
        error={errors?.phone}
      />
      <TextField id="password" name="password" type="password" label="Contraseña" autoComplete="new-password" error={errors?.password} />
      <FormMessage>{state.message}</FormMessage>
      <SubmitButton pendingLabel="Creando cuenta…">Crear cuenta</SubmitButton>
    </form>
  );
}
