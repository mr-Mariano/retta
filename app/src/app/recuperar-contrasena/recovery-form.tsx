"use client";

import { useActionState } from "react";
import { requestPasswordRecovery } from "@/app/auth/actions";
import { FormMessage, SubmitButton, TextField } from "@/components/form";

export function RecoveryForm() {
  const [state, action] = useActionState(requestPasswordRecovery, {});

  if (state.sent) {
    return (
      <p role="status" className="text-[15px] text-muted">
        Si hay una cuenta con ese correo, recibirás un enlace. Ábrelo en este mismo navegador y revisa también tu carpeta de spam.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3.5">
      <p className="text-[15px] text-muted">Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.</p>
      <TextField id="email" name="email" type="email" label="Correo" autoComplete="email" />
      <div aria-live="polite"><FormMessage>{state.error}</FormMessage></div>
      <SubmitButton pendingLabel="Enviando…">Enviar enlace</SubmitButton>
    </form>
  );
}
