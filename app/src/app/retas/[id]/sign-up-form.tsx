"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { FieldError } from "@/components/form";
import { signUpForMatch, type SignUpResult } from "./actions";

function Submit({ label, className }: { label: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-60`}>
      {pending ? "Inscribiendo…" : label}
    </button>
  );
}

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
      <Submit label={label} className={className} />
      {state.error && <FieldError id={`signup-error-${matchId}`}>{state.error}</FieldError>}
    </form>
  );
}
