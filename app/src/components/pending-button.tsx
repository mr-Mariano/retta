"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * Submit button for actions with money or that can't be undone (waiting
 * feedback A, 2026-11-04): it shrinks on tap and, while the form submits,
 * shows a spinner with what is happening ("Inscribiendo…").
 */
export function PendingButton({
  children,
  pendingLabel,
  className,
  disabled = false,
  form,
}: {
  children: ReactNode;
  pendingLabel: string;
  className: string;
  disabled?: boolean;
  form?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      form={form}
      disabled={disabled || pending}
      data-pending={pending}
      aria-busy={pending}
      className={`pending-button flex items-center justify-center gap-2.5 disabled:opacity-60 data-[pending=true]:opacity-100 ${className}`}
    >
      {pending ? (
        <>
          <span aria-hidden="true" className="button-spinner" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
