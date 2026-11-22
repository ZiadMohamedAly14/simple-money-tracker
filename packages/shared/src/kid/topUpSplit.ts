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
  const sink = balancingJarOf(jarIds, spendJarId);
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

/** A ready-made way to split a Top-up, chosen under its total. */
export type TopUpPreset = 'allToSpend' | 'evenly' | 'sameAsLast';

/**
 * The split a preset gives `total`. Split evenly gives every Jar the same
 * share; the rest follow `suggestTopUpSplit`. Remainders go to Spend.
 */
export function presetSplit(preset: TopUpPreset, total: number, options: SuggestSplitOptions): JarSplit[] {
  const lastSplit =
    preset === 'evenly'
      ? options.jarIds.map((jarId) => ({ jarId, amount: 1 }))
      : preset === 'sameAsLast'
        ? options.lastSplit
        : null;
  return suggestTopUpSplit(total, { ...options, lastSplit });
}

/**
 * The preset that gives exactly this split of `total`, or null if none does
 * (a custom split). All to Spend wins over the others when several match;
 * Same as last time is checked only when `lastSplit` is given.
 */
export function presetOf(total: number, splits: readonly JarSplit[], options: SuggestSplitOptions): TopUpPreset | null {
  const key = (list: readonly JarSplit[]) =>
    [...list]
      .sort((a, b) => (a.jarId < b.jarId ? -1 : a.jarId > b.jarId ? 1 : 0))
      .map((split) => `${split.jarId}:${split.amount}`)
      .join(',');
  const wanted = key(splits);
  const presets: TopUpPreset[] = options.lastSplit ? ['allToSpend', 'evenly', 'sameAsLast'] : ['allToSpend', 'evenly'];
  return presets.find((preset) => key(presetSplit(preset, total, options)) === wanted) ?? null;
}

/** Shares a parent typed for a Custom split, and the total they were typed against. */
export interface CustomShares {
  total: number;
  /** Minor units per Jar; the balancing Jar's entry, if any, is ignored. */
  shares: Readonly<Record<string, number>>;
}

/**
 * A Custom split of `total`: the typed shares, with the balancing Jar (Spend)
 * taking whatever is left. If the total has changed since the shares were
 * typed, each share keeps its proportion (rounded down). `over` is how far
 * the shares go past the total; the split can't be saved until it is 0.
 */
export function customSplit(
  total: number,
  custom: CustomShares,
  { jarIds, spendJarId }: Pick<SuggestSplitOptions, 'jarIds' | 'spendJarId'>,
): { splits: JarSplit[]; over: number } {
  const sink = balancingJarOf(jarIds, spendJarId);
  const scaled = (amount: number) =>
    custom.total > 0 && custom.total !== total ? Number((BigInt(amount) * BigInt(total)) / BigInt(custom.total)) : amount;
  const shares = new Map<string, number>(jarIds.map((id) => [id, id === sink ? 0 : scaled(custom.shares[id] ?? 0)]));
  const given = [...shares.values()].reduce((acc, amount) => acc + amount, 0);
  shares.set(sink, Math.max(0, total - given));
  const splits = jarIds.map((jarId) => ({ jarId, amount: shares.get(jarId)! })).filter((split) => split.amount > 0);
  return { splits, over: Math.max(0, given - total) };
}

/** The Jar that takes remainders: Spend, or the first Jar if Spend is archived. */
export function balancingJarOf(jarIds: readonly string[], spendJarId: string): string {
  return jarIds.includes(spendJarId) ? spendJarId : jarIds[0]!;
}
