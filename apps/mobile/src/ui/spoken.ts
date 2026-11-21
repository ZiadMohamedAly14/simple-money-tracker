/**
 * Screen-reader text built from the pieces a row shows (title, subtitle,
 * amount), so a pressable row that groups them still reads all of them.
 * Empty pieces are dropped; `separator` is the language's list separator
 * (`common.listSeparator`: ", " in English, "، " in Arabic).
 */
export function joinSpoken(parts: readonly (string | null | undefined | false)[], separator: string): string {
  return parts.filter((part): part is string => typeof part === 'string' && part.trim() !== '').join(separator);
}
