/**
 * Wraps text that must read left to right (emails, "3,420 / 3,000") in a
 * Unicode left-to-right isolate, so it isn't scrambled inside Arabic text.
 */
export function ltrIsolate(text: string): string {
  return `⁦${text}⁩`;
}
