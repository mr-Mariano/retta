"use client";

import { useMemo, useState } from "react";
import { countryOptions, DEFAULT_COUNTRY } from "@/lib/phone";
import { FieldError } from "./form";

interface PhoneFieldProps {
  label?: string;
  hint?: string;
  defaultValue?: string;
  defaultCountry?: string;
  error?: string;
  /** Larger input for the one-question profile step. */
  large?: boolean;
}

/** Country selector (native select over a "MX +52" label) plus national number. */
export function PhoneField({ label = "Teléfono", hint, defaultValue, defaultCountry, error, large }: PhoneFieldProps) {
  const options = useMemo(countryOptions, []);
  const [country, setCountry] = useState(
    options.some((o) => o.code === defaultCountry) ? defaultCountry! : DEFAULT_COUNTRY,
  );
  const selected = options.find((o) => o.code === country) ?? options[0];

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="phone" className="text-[13px] font-semibold text-muted">
        {label}
      </label>
      <div
        className={`flex items-center overflow-hidden bg-surface ${
          large ? "h-16 rounded-2xl" : "h-[50px] rounded-[6px]"
        } ${error ? "border-[1.5px] border-danger" : large ? "border-[1.5px] border-ink" : "border border-line"}`}
      >
        <div className="relative flex h-full shrink-0 items-center gap-1.5 border-r border-line pr-2.5 pl-3.5">
          <span aria-hidden="true" className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-muted">{selected.code}</span>
            <span className={`font-semibold ${large ? "text-lg" : "text-[15px]"}`}>+{selected.callingCode}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
          <select
            name="phone_country"
            aria-label="País"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {options.map((o) => (
              // Country names come from Intl, which can differ slightly between server and browser.
              <option key={o.code} value={o.code} suppressHydrationWarning>
                {o.name} (+{o.callingCode})
              </option>
            ))}
          </select>
        </div>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          defaultValue={defaultValue}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "phone-error" : hint ? "phone-hint" : undefined}
          className={`h-full min-w-0 flex-1 bg-transparent px-3.5 text-ink focus:outline-none ${
            large ? "text-[22px] font-semibold tracking-wide" : "text-[16px]"
          }`}
        />
      </div>
      {error ? (
        <FieldError id="phone-error">{error}</FieldError>
      ) : (
        hint && (
          <p id="phone-hint" className="text-xs text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
