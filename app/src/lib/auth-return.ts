/** Accept only destinations used by the guest flows. */
export function authReturn(value: unknown): string {
  if (typeof value !== "string") return "";
  return /^\/(?:retas\/[\da-f-]{36}|organizar\/nueva)$/i.test(value) ? value : "";
}

export function authHref(page: "/entrar" | "/registro", destination: string) {
  return destination ? `${page}?${new URLSearchParams({ next: destination })}` : page;
}
