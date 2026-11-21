import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoneyParts } from '@money-tracker/shared';
import { useAccountSettings } from '@/data/useAccountSettings';
import type { WalletJar } from '@/data/kidWallet';
import type { JarRow, KidTransactionRow } from '@/db/schema';
import { useDateLabel } from '@/i18n/useDateLabel';
import { useLanguage } from '@/i18n/useLanguage';
import { ListRow, Text, type GlyphName, type TextTone } from '@/ui';
import { jarStyle } from './useKidWallet';

export interface KidHistoryListProps {
  /** Newest first (`kidTransactionsQuery`). */
  transactions: readonly KidTransactionRow[];
  /** Every Jar of the wallet, archived ones included, for names. */
  jarRows: readonly JarRow[];
  /** Wallet Jars, for each Jar's default key (its icon). */
  walletJars: readonly WalletJar[];
  /** The kid reads "Your parent added 50"; the parent reads "Top-up +50" (design flaw 4). */
  viewer: 'kid' | 'parent';
  /** Tapping a row; rows the viewer can't change aren't pressable. */
  onPress?: (transaction: KidTransactionRow) => void;
  /** Which rows `onPress` applies to. */
  canOpen?: (transaction: KidTransactionRow) => boolean;
}

/**
 * A Kid Wallet's history (PDF page 9, "My history"): Top-ups, Jar Transfers
 * and Kid Expenses, newest first, under a heading per day. Jar Transfer
 * wording is neutral ("10 moved to Save"), since only parents make them
 * (design flaw 4).
 */
export function KidHistoryList({ transactions, jarRows, walletJars, viewer, onPress, canOpen = () => true }: KidHistoryListProps) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { currency, numberingSystem } = useAccountSettings();
  const dateLabel = useDateLabel(numberingSystem);
  const amount = (minor: number) => formatMoneyParts(minor, { language, currency, numberingSystem }).amount;
  const jarName = (id: string | null) => jarRows.find((jar) => jar.id === id)?.name ?? '';
  const jarIcon = (id: string | null): GlyphName => jarStyle(walletJars.find((jar) => jar.id === id)?.key ?? null).icon;

  if (transactions.length === 0) return <Text tone="muted">{t('kid.history.empty')}</Text>;

  function row(tx: KidTransactionRow): { icon: GlyphName; title: string; subtitle: string; end: string; endTone: TextTone } {
    switch (tx.kind) {
      case 'topUp':
        return {
          icon: 'app:income-money',
          title: viewer === 'kid' ? t('kid.history.topUpKid', { amount: amount(tx.amount) }) : t('kid.wallet.topUpRow', { amount: amount(tx.amount) }),
          subtitle: tx.note ?? t('kid.history.topUpSub'),
          end: `+${amount(tx.amount)}`,
          endTone: 'primary',
        };
      case 'jarTransfer':
        return {
          icon: 'app:move-money',
          title: t('kid.history.moved', { amount: amount(tx.amount), jar: jarName(tx.toJarId) }),
          subtitle: t('kid.history.from', { jar: jarName(tx.jarId) }),
          end: amount(tx.amount),
          endTone: 'text',
        };
      case 'kidExpense':
        return {
          icon: jarIcon(tx.jarId),
          title: tx.note || t('kid.history.spent', { amount: amount(tx.amount) }),
          subtitle: t('kid.history.from', { jar: jarName(tx.jarId) }),
          end: amount(-tx.amount),
          endTone: 'text',
        };
    }
  }

  return (
    <>
      {transactions.map((tx, index) => {
        const { icon, title, subtitle, end, endTone } = row(tx);
        const newDay = index === 0 || transactions[index - 1]!.date !== tx.date;
        return (
          <Fragment key={tx.id}>
            {newDay ? (
              <Text weight="semibold" tone="muted" className="pt-2 text-sm">
                {dateLabel(tx.date)}
              </Text>
            ) : null}
            <ListRow
              icon={icon}
              title={title}
              subtitle={subtitle}
              end={end}
              endTone={endTone}
              onPress={onPress && canOpen(tx) ? () => onPress(tx) : undefined}
            />
          </Fragment>
        );
      })}
    </>
  );
}
