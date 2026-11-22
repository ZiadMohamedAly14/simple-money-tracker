/**
 * The Expected Income still to be recorded as Income this Month: what the
 * hero card's record chip offers. Null once Income reaches Expected Income, or
 * when the Month has no Expected Income, so the chip hides.
 */
export function expectedIncomeGap({ income, expectedIncome }: { income: number; expectedIncome: number }): number | null {
  return income < expectedIncome ? expectedIncome - income : null;
}
