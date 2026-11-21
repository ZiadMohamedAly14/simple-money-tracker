import type { KidTransactionFields } from '../sync/records';

/** Jar ID → balance in minor units. */
export type JarBalances = Record<string, number>;

type BalanceFields = Pick<KidTransactionFields, 'kind' | 'amount' | 'splits' | 'jarId' | 'toJarId'>;

/**
 * Works out each Jar's balance from a Kid Wallet's live (not deleted) Kid
 * Transactions. Balances are never stored or synced (spec), so the parent's
 * phone and the kid's device always agree. Every listed Jar appears (0 if
 * untouched); a Jar that isn't listed but holds money (an archived one) is
 * included too, so no money disappears. A balance can be negative: the
 * server never rejects a Kid Expense, so two offline devices can both spend
 * the same money (spec).
 */
export function jarBalances(jarIds: readonly string[], kidTransactions: readonly BalanceFields[]): JarBalances {
  const balances: JarBalances = Object.fromEntries(jarIds.map((id) => [id, 0]));
  const add = (jarId: string | null, amount: number) => {
    if (jarId === null) return;
    balances[jarId] = (balances[jarId] ?? 0) + amount;
  };
  for (const transaction of kidTransactions) {
    switch (transaction.kind) {
      case 'topUp':
        transaction.splits.forEach((split) => add(split.jarId, split.amount));
        break;
      case 'kidExpense':
        add(transaction.jarId, -transaction.amount);
        break;
      case 'jarTransfer':
        add(transaction.jarId, -transaction.amount);
        add(transaction.toJarId, transaction.amount);
        break;
    }
  }
  return balances;
}

/**
 * The most a Kid Expense from `jarId` may be: the Jar's balance, never below
 * zero, so a Jar that went negative after a sync blocks further spending
 * (spec). When editing a Kid Expense or Jar Transfer, pass it as `editing`:
 * if it came out of the same Jar, it may keep its old amount (or take less)
 * even when the Jar has since gone below zero, and only an increase is
 * checked against what the Jar still holds. Jar Transfers use the same rule
 * for their source Jar.
 */
export function spendableFrom(
  balances: JarBalances,
  jarId: string,
  editing?: Pick<KidTransactionFields, 'kind' | 'amount' | 'jarId'> | null,
): number {
  const alreadyTaken = editing && editing.kind !== 'topUp' && editing.jarId === jarId ? editing.amount : 0;
  return alreadyTaken + Math.max(0, balances[jarId] ?? 0);
}

/** The Jars below zero; the app shows them, blocks spending and flags them in the Parent Area. */
export function negativeJarIds(balances: JarBalances): string[] {
  return Object.keys(balances).filter((jarId) => balances[jarId]! < 0);
}
