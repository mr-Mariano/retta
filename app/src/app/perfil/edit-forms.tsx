"use client";

import { useActionState } from "react";
import { FieldError, SubmitButton, TextField } from "@/components/form";
import { PhoneField } from "@/components/phone-field";
import { updateName, updatePhone, updateSocials, type EditState } from "./actions";

export function NameForm({ fullName }: { fullName: string }) {
  const [state, action] = useActionState<EditState, FormData>(updateName, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <TextField id="full_name" name="full_name" label="Nombre completo" autoComplete="name" defaultValue={state.values?.full_name ?? fullName} error={state.error} />
      <SubmitButton pendingLabel="Guardando…">Guardar</SubmitButton>
    </form>
  );
}

export function PhoneForm({ national, country }: { national: string; country: string }) {
  const [state, action] = useActionState<EditState, FormData>(updatePhone, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <PhoneField defaultValue={state.values?.phone ?? national} defaultCountry={state.values?.phone_country ?? country} error={state.error} />
      <SubmitButton pendingLabel="Guardando…">Guardar</SubmitButton>
    </form>
  );
}

function PrefixedField({ id, label, prefix, defaultValue, placeholder }: { id: string; label: string; prefix: string; defaultValue: string; placeholder: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-muted">
        {label}
      </label>
      <div className="flex h-[50px] items-center gap-1 rounded-[14px] border border-line bg-base px-4 text-[16px] focus-within:ring-2 focus-within:ring-ink/40">
        <span className="text-muted">{prefix}</span>
        <input
          id={id}
          name={id}
          defaultValue={defaultValue}
          placeholder={placeholder}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-ink placeholder:text-muted focus:outline-none"
        />
      </div>
    </div>
  );
}

export function SocialsForm({ instagram, facebook }: { instagram: string; facebook: string }) {
  const [state, action] = useActionState<EditState, FormData>(updateSocials, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <PrefixedField id="instagram" label="Instagram" prefix="@" defaultValue={state.values?.instagram ?? instagram} placeholder="tu.usuario" />
      <PrefixedField id="facebook" label="Facebook" prefix="facebook.com/" defaultValue={state.values?.facebook ?? facebook} placeholder="tu.usuario" />
      <span className="text-[13px] leading-snug text-muted">Solo las ven jugadores con quienes ya compartiste una reta.</span>
      <FieldError id="redes-error">{state.error}</FieldError>
      <SubmitButton pendingLabel="Guardando…">Guardar</SubmitButton>
    </form>
  );
}
