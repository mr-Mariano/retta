"use client";

import { useActionState } from "react";
import { resetRecoveredPassword } from "@/app/auth/actions";
import { FormMessage, SubmitButton, TextField } from "@/components/form";

export function NewPasswordForm() {
  const [state, action] = useActionState(resetRecoveredPassword, {});
  return (
    <form action={action} className="flex flex-col gap-3.5">
      <p className="text-sm text-muted">Usa al menos 8 caracteres.</p>
      <TextField id="new-password" name="password" type="password" label="Contraseña nueva" autoComplete="new-password" />
      <TextField id="confirm-password" name="confirm_password" type="password" label="Confirma tu contraseña" autoComplete="new-password" />
      <div aria-live="polite"><FormMessage>{state.error}</FormMessage></div>
      <SubmitButton pendingLabel="Guardando…">Guardar contraseña</SubmitButton>
    </form>
  );
}
