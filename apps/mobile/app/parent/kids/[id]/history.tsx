import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { KidTransactionRow } from '@/db/schema';
import { KidHistoryList } from '@/kid/KidHistoryList';
import { useKidWallet } from '@/kid/useKidWallet';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { Screen, ScreenHeader } from '@/ui';

/**
 * A kid's full history from the Parent Area (story 45): Top-ups, Jar
 * Transfers and Kid Expenses, newest first. The parent can open any of them
 * to edit or delete it (adults can change anything, spec).
 */
export default function ParentKidHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { kid, jarRows, transactions, wallet } = useKidWallet(id);

  function open(tx: KidTransactionRow) {
    if (tx.kind === 'topUp') router.push({ pathname: '/parent/kids/[id]/top-up', params: { id, topUpId: tx.id } });
    else if (tx.kind === 'jarTransfer') router.push({ pathname: '/parent/kids/[id]/transfer', params: { id, transferId: tx.id } });
    else router.push({ pathname: '/kid/[id]/spend', params: { id, expenseId: tx.id } });
  }

  return (
    <ThemeProvider name="kid">
      <Screen scroll>
        <ScreenHeader title={t('kid.history.parentTitle')} onBack={() => router.back()} />
        {kid ? <KidHistoryList transactions={transactions} jarRows={jarRows} walletJars={wallet.jars} viewer="parent" onPress={open} /> : null}
      </Screen>
    </ThemeProvider>
  );
}
