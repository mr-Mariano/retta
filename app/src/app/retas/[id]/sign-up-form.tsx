"use client";

import { useActionState } from "react";
import { FieldError } from "@/components/form";
import { signUpForMatch, type SignUpResult } from "./actions";
import { PendingButton } from "@/components/pending-button";


/** Signs up in one step (session 2): pays the remainder after applying credit. */
export function SignUpForm({
  matchId,
  label,
  className,
  formClassName,
}: {
  matchId: string;
  label: string;
  className: string;
  formClassName?: string;
}) {
  const [state, action] = useActionState<SignUpResult>(() => signUpForMatch(matchId), {});

  return (
    <form action={action} className={`flex flex-col gap-2 ${formClassName ?? ""}`}>
      <PendingButton pendingLabel="Inscribiendo…" className={className}>
        {label}
      </PendingButton>
      {state.error && <FieldError id={`signup-error-${matchId}`}>{state.error}</FieldError>}
    </form>
  );
}
