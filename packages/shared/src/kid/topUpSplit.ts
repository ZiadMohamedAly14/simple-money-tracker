import type { JarSplit } from '../sync/records';

/**
 * Why a Top-up's split can't be stored, or null if it can. The split must
 * name each Jar at most once, with a positive whole share, and add up to
 * exactly the total (spec). The app checks this before saving and the
 * server checks it again on sync.
 */
export function topUpSplitProblem(total: number, splits: readonly JarSplit[]): string | null {
  if (splits.length === 0) return 'must name at least one Jar';
  if (splits.some((split) => !Number.isSafeInteger(split.amount) || split.amount <= 0)) {
    return 'each share must be a positive whole number of minor units';
  }
  if (new Set(splits.map((split) => split.jarId)).size !== splits.length) return 'each Jar may appear once';
  const sum = splits.reduce((acc, split) => acc + split.amount, 0);
  return sum === total ? null : 'must add up to the total';
}

export interface SuggestSplitOptions {
  /** The wallet's Jars that can take money now (not archived), in display order. */
  jarIds: readonly string[];
  /** The Spend Jar: the default when nothing was split before, and where rounding remainders go. */
  spendJarId: string;
  /** The wallet's most recent Top-up split, or null if there is none. */
  lastSplit: readonly JarSplit[] | null;
}

/**
 * The split a new Top-up of `total` starts with: the last Top-up's
 * proportions, or everything in Spend (spec, story 42). Shares are whole
 * minor units rounded down; whatever is left goes to Spend (design flaw 8),
 * so the result always adds up to `total`. A share belonging to a Jar that
 * has since been archived goes to Spend too. If Spend is archived, the first
 * Jar takes its place. Jars whose share comes to 0 are left out.
 */
export function suggestTopUpSplit(total: number, { jarIds, spendJarId, lastSplit }: SuggestSplitOptions): JarSplit[] {
  if (total <= 0 || jarIds.length === 0) return [];
  const sink = jarIds.includes(spendJarId) ? spendJarId : jarIds[0]!;
  const weights = lastSplit ?? [];
  const weightTotal = weights.reduce((acc, split) => acc + BigInt(split.amount), 0n);

  const shares = new Map<string, number>(jarIds.map((id) => [id, 0]));
  let given = 0;
  if (weightTotal > 0n) {
    for (const { jarId, amount } of weights) {
      if (jarId === sink || !shares.has(jarId)) continue;
      const share = Number((BigInt(total) * BigInt(amount)) / weightTotal);
      shares.set(jarId, share);
      given += share;
    }
  }
  shares.set(sink, total - given);
  return jarIds.map((jarId) => ({ jarId, amount: shares.get(jarId)! })).filter((split) => split.amount > 0);
}
