/**
 * Whole seconds from `from` until `to`, rounded up and never below 1: the
 * `retryAfterSeconds` of a resend wait or a wrong-PIN lock, on the server and
 * the device alike. Takes Dates or epoch milliseconds.
 */
export function secondsUntil(from: Date | number, to: Date | number): number {
  return Math.max(1, Math.ceil((Number(to) - Number(from)) / 1000));
}
