const ARABIC_INDIC_ZERO = 0x0660; // ٠
const PERSIAN_ZERO = 0x06f0; // ۰

/** Replaces Arabic-Indic and Persian digits with Western ones; everything else is kept. */
export function toWesternDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - ARABIC_INDIC_ZERO))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - PERSIAN_ZERO));
}
