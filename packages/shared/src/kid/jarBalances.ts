import type { KidTransactionFields } from '../sync/records';

/** Jar ID → balance in minor units. */
export type JarBalances = Record<string, number>;

/**
 * Works out each Jar's balance from a Kid Wallet's live (not deleted) Kid
 * Transactions. Balances are never stored or synced (spec), so the parent's
 * phone and the kid's device always agree. Every listed Jar appears (0 if
 * untouched); a Jar that isn't listed but holds money (an archived one) is
 * included too, so no money disappears.
 */
export function jarBalances(
  jarIds: readonly string[],
  kidTransactions: readonly Pick<KidTransactionFields, 'kind' | 'amount' | 'splits'>[],
): JarBalances {
  const balances: JarBalances = Object.fromEntries(jarIds.map((id) => [id, 0]));
  const add = (jarId: string, amount: number) => {
    balances[jarId] = (balances[jarId] ?? 0) + amount;
  };
  for (const transaction of kidTransactions) {
    if (transaction.kind === 'topUp') transaction.splits.forEach((split) => add(split.jarId, split.amount));
  }
  return balances;
}
