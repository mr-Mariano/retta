"use client";

import { useActionState } from "react";
import { signInWithEmail, type SignInState } from "@/app/auth/actions";
import { FormMessage, SubmitButton, TextField } from "@/components/form";

export function EntrarForm({ initialError, destination }: { initialError?: string; destination: string }) {
  const [state, action] = useActionState<SignInState, FormData>(signInWithEmail, { error: initialError });

  return (
    <form action={action} className="flex flex-col gap-3.5" noValidate>
      <input type="hidden" name="next" value={destination} />
      <TextField id="email" name="email" type="email" label="Correo" autoComplete="email" defaultValue={state.email} />
      <TextField id="password" name="password" type="password" label="Contraseña" autoComplete="current-password" />
      <div aria-live="polite">
        <FormMessage>{state.error}</FormMessage>
      </div>
      <SubmitButton pendingLabel="Entrando…">Iniciar sesión</SubmitButton>
    </form>
  );
}
