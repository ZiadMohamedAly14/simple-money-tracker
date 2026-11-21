/**
 * How much of a Month's Expected Income has come in, from 0 to 1 (Income
 * above the plan is simply full). Null when the Month has no Expected
 * Income, so screens hide the bar instead of dividing by zero.
 */
export function incomeProgress({ income, expectedIncome }: { income: number; expectedIncome: number }): number | null {
  if (expectedIncome <= 0) return null;
  return Math.min(1, Math.max(0, income / expectedIncome));
}
