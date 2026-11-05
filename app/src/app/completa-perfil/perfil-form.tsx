"use client";

import { useActionState } from "react";
import { completeProfile, type ProfileState } from "@/app/auth/actions";
import { SubmitButton } from "@/components/form";
import { PhoneField } from "@/components/phone-field";

export function PerfilForm({ account }: { account: { initials: string; label: string } }) {
  const [state, action] = useActionState<ProfileState, FormData>(completeProfile, {});

  return (
    <form action={action} className="flex flex-1 flex-col gap-7" noValidate>
      <PhoneField large defaultValue={state.values?.phone} defaultCountry={state.values?.country} error={state.error} />
      <div className="mt-auto flex flex-col gap-3">
        <div className="flex items-center gap-2.5 rounded-[6px] border border-line bg-surface px-3.5 py-3">
          <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-elevated text-xs font-bold">
            {account.initials}
          </span>
          <span className="truncate text-sm text-muted">{account.label}</span>
        </div>
        <SubmitButton pendingLabel="Guardando…">Continuar</SubmitButton>
      </div>
    </form>
  );
}
