import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import type { DefaultJarKey } from '@money-tracker/shared';
import { jarsQuery, kidProfileQuery, kidTransactionsQuery, walletOf } from '@/data/kidWallet';
import { localDb, localStore } from '@/db/appDatabase';
import type { IconCircleTone, IconName, ProgressTone } from '@/ui';

/** One Kid Wallet, live from the local database: the profile, its Jars, Kid Transactions (newest first) and balances. */
export function useKidWallet(kidProfileId: string) {
  const { data: kids, updatedAt } = useLiveQuery(kidProfileQuery(localDb, kidProfileId), [kidProfileId]);
  const { data: jarRows } = useLiveQuery(jarsQuery(localDb, kidProfileId), [kidProfileId]);
  const { data: transactions } = useLiveQuery(kidTransactionsQuery(localDb, kidProfileId), [kidProfileId]);
  return {
    /** Undefined until the first read, null if there is no such Kid Profile. */
    kid: updatedAt ? (kids[0] ?? null) : undefined,
    jarRows,
    transactions,
    wallet: walletOf(localStore.accountId(), jarRows, transactions),
  };
}

const JAR_STYLE: Record<DefaultJarKey | 'custom', { icon: IconName; tone: IconCircleTone & ProgressTone }> = {
  save: { icon: 'flask-outline', tone: 'jar-save' },
  spend: { icon: 'bag-handle-outline', tone: 'jar-spend' },
  give: { icon: 'gift-outline', tone: 'jar-give' },
  // Jars the parent adds share the primary color.
  custom: { icon: 'star-outline', tone: 'primary' },
};

/** Icon and color for a Jar: Save, Spend and Give have their own; added Jars share one. */
export const jarStyle = (key: DefaultJarKey | null) => JAR_STYLE[key ?? 'custom'];
