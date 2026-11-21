import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import type { DefaultJarKey } from '@money-tracker/shared';
import { jarsQuery, kidProfileQuery, kidTransactionsQuery, walletOf } from '@/data/kidWallet';
import { localDb, localStore } from '@/db/appDatabase';
import type { GlyphName, IconCircleTone, ProgressTone } from '@/ui';

/** One Kid Wallet, live from the local database: the profile, its Jars, Kid Transactions (newest first) and balances. */
export function useKidWallet(kidProfileId: string) {
  const { data: kids, updatedAt: kidsRead } = useLiveQuery(kidProfileQuery(localDb, kidProfileId), [kidProfileId]);
  const { data: jarRows, updatedAt: jarsRead } = useLiveQuery(jarsQuery(localDb, kidProfileId), [kidProfileId]);
  const { data: transactions, updatedAt: transactionsRead } = useLiveQuery(kidTransactionsQuery(localDb, kidProfileId), [kidProfileId]);
  return {
    /** Undefined until every query's first read, null if there is no such Kid Profile. */
    kid: kidsRead && jarsRead && transactionsRead ? (kids[0] ?? null) : undefined,
    jarRows,
    transactions,
    wallet: walletOf(localStore.accountId(), jarRows, transactions),
  };
}

const JAR_STYLE: Record<DefaultJarKey | 'custom', { icon: GlyphName; tone: IconCircleTone & ProgressTone }> = {
  save: { icon: 'app:jar-save', tone: 'jar-save' },
  spend: { icon: 'app:shopping-spend', tone: 'jar-spend' },
  give: { icon: 'app:gift-give', tone: 'jar-give' },
  // Jars the parent adds share the primary color.
  custom: { icon: 'app:jar-save', tone: 'primary' },
};

/** Icon and color for a Jar: Save, Spend and Give have their own; added Jars share one. */
export const jarStyle = (key: DefaultJarKey | null) => JAR_STYLE[key ?? 'custom'];
