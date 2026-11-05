"use client";

import { useActionState } from "react";
import { FieldError } from "@/components/form";
import { cancelOwnMatch, type CancelState } from "../actions";
import { PendingButton } from "@/components/pending-button";

function Submit() {
  return (
    <PendingButton pendingLabel="Cancelando…" className="h-[52px] rounded-full bg-danger text-[17px] font-semibold text-[#1a0805]">
      Cancelar la reta
    </PendingButton>
  );
}

export function CancelForm({ matchId }: { matchId: string }) {
  const [state, action] = useActionState<CancelState, FormData>(cancelOwnMatch.bind(null, matchId), {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="note" className="text-[13px] font-semibold text-muted">
          Motivo (obligatorio)
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          maxLength={200}
          placeholder="La cancha está en mantenimiento"
          className="rounded-[14px] border border-line bg-base px-4 py-3 text-[16px] text-ink placeholder:text-muted focus:ring-2 focus:ring-ink/40 focus:outline-none"
        />
        <FieldError id="note-error">{state.error}</FieldError>
      </div>
      <Submit />
    </form>
  );
}
