// Junta classes condicionais (clsx mínimo, sem dependência).
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
