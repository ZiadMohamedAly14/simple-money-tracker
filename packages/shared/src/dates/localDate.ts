const pad = (n: number, width: number): string => String(n).padStart(width, '0');

/**
 * A moment as the device's local calendar date, `YYYY-MM-DD`. A Transaction
 * stores this and it is never converted between time zones (spec).
 */
export function toLocalDate(moment: Date): string {
  return `${pad(moment.getFullYear(), 4)}-${pad(moment.getMonth() + 1, 2)}-${pad(moment.getDate(), 2)}`;
}
