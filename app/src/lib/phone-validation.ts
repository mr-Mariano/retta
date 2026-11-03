import "server-only";
import {
  getExampleNumber,
  isSupportedCountry,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
  type CountryCode,
} from "libphonenumber-js/max";
import examples from "libphonenumber-js/mobile/examples";
import { DEFAULT_COUNTRY } from "./phone";

export type PhoneResult = { ok: true; e164: string } | { ok: false; error: string };

/** Validates a national number for a country; returns it in E.164 or a Spanish error. */
export function parsePhone(raw: string, countryInput: string): PhoneResult {
  const country: CountryCode = isSupportedCountry(countryInput) ? countryInput : DEFAULT_COUNTRY;

  if (!raw.trim()) return { ok: false, error: "Escribe tu teléfono." };

  const expectedDigits = getExampleNumber(country, examples)?.nationalNumber.length;
  const countryName = new Intl.DisplayNames(["es"], { type: "region" }).of(country) ?? country;
  const expected = expectedDigits ? ` En ${countryName} son ${expectedDigits}.` : "";

  const length = validatePhoneNumberLength(raw, country);
  if (length === "TOO_SHORT") return { ok: false, error: `Faltan dígitos.${expected}` };
  if (length === "TOO_LONG") return { ok: false, error: `Sobran dígitos.${expected}` };

  const phone = parsePhoneNumberFromString(raw, country);
  if (!phone?.isValid()) return { ok: false, error: "Revisa el número." };

  return { ok: true, e164: phone.number };
}
