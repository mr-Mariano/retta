import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js";

export const DEFAULT_COUNTRY: CountryCode = "MX";

export interface CountryOption {
  code: CountryCode;
  name: string;
  callingCode: string;
}

/** Every country with its Spanish name and calling code; Mexico first, the rest by name. */
export function countryOptions(): CountryOption[] {
  const names = new Intl.DisplayNames(["es"], { type: "region" });
  const options = getCountries().map((code) => ({
    code,
    name: names.of(code) ?? code,
    callingCode: getCountryCallingCode(code),
  }));
  options.sort((a, b) => a.name.localeCompare(b.name, "es"));
  const mexico = options.findIndex((o) => o.code === DEFAULT_COUNTRY);
  return [options[mexico], ...options.slice(0, mexico), ...options.slice(mexico + 1)];
}
