"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { dropOutOfMatch, type DropOutResult } from "@/app/retas/[id]/actions";
import { FieldError } from "./form";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-[52px] w-full items-center justify-center rounded-full bg-action text-[17px] font-semibold text-on-action disabled:opacity-60"
    >
      {pending ? "Dando de baja…" : "Sí, darme de baja"}
    </button>
  );
}

export function DropOutButton({ matchId }: { matchId: string }) {
  const [state, action] = useActionState<DropOutResult>(() => dropOutOfMatch(matchId), {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <Submit />
      {state.error && <FieldError id={`baja-error-${matchId}`}>{state.error}</FieldError>}
    </form>
  );
}
