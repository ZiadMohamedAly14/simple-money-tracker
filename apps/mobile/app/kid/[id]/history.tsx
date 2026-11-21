import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { KidHistoryList } from '@/kid/KidHistoryList';
import { useKidWallet } from '@/kid/useKidWallet';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { Screen, ScreenHeader } from '@/ui';

/**
 * "My history" (PDF page 9): Top-ups, Jar Transfers and the kid's Kid
 * Expenses, newest first. Only Kid Expenses open (to fix or delete them);
 * Top-ups and Jar Transfers are the parent's (spec).
 */
export default function KidHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { kid, jarRows, transactions, wallet } = useKidWallet(id);
  return (
    <ThemeProvider name="kid">
      <Screen scroll>
        <ScreenHeader title={t('kid.history.title')} onBack={() => router.back()} />
        {kid ? (
          <KidHistoryList
            transactions={transactions}
            jarRows={jarRows}
            walletJars={wallet.jars}
            viewer="kid"
            canOpen={(tx) => tx.kind === 'kidExpense'}
            onPress={(tx) => router.push({ pathname: '/kid/[id]/spend', params: { id, expenseId: tx.id } })}
          />
        ) : null}
      </Screen>
    </ThemeProvider>
  );
}
