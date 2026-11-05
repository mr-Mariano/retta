"use client";

import { useActionState } from "react";
import { dropOutOfMatch, type DropOutResult } from "@/app/retas/[id]/actions";
import { FieldError } from "./form";
import { PendingButton } from "@/components/pending-button";


export function DropOutButton({ matchId }: { matchId: string }) {
  const [state, action] = useActionState<DropOutResult>(() => dropOutOfMatch(matchId), {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <PendingButton pendingLabel="Dando de baja…" className="h-[52px] w-full rounded-[6px] bg-action text-[17px] font-semibold text-on-action">
        Sí, darme de baja
      </PendingButton>
      {state.error && <FieldError id={`baja-error-${matchId}`}>{state.error}</FieldError>}
    </form>
  );
}
