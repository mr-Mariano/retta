"use client";

import { useState, type ReactNode } from "react";
import { PendingButton } from "@/components/pending-button";

const inputBox =
  "h-[50px] w-full rounded-[6px] border bg-surface px-4 text-[16px] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/40";

export function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="flex items-start gap-1.5 text-[13px] text-danger">
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 7v6" />
        <path d="M12 17h.01" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

interface TextFieldProps {
  id: string;
  name: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  defaultValue?: string;
  error?: ReactNode;
}

export function TextField({ id, name, label, type = "text", autoComplete, defaultValue, error }: TextFieldProps) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={isPassword && visible ? "text" : type}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${inputBox} ${error ? "border-[1.5px] border-danger" : "border-line"} ${isPassword ? "pr-24" : ""}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            className="absolute top-[3px] right-1 h-11 rounded-[6px] px-3.5 text-sm font-semibold text-muted"
          >
            {visible ? "Ocultar" : "Mostrar"}
          </button>
        )}
      </div>
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}

/** Primary pill button that shows a pending label while its form submits. */
export function SubmitButton({ children, pendingLabel }: { children: ReactNode; pendingLabel: string }) {
  return (
    <PendingButton pendingLabel={pendingLabel} className="mt-1.5 h-[52px] w-full rounded-[6px] bg-action text-[17px] font-bold text-on-action">
      {children}
    </PendingButton>
  );
}

export function FormMessage({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <FieldError id="form-message">{children}</FieldError>;
}
