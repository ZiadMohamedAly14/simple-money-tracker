import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  applyKeypadKey,
  currencyMinorDigits,
  evaluateNonNegativeAmount,
  evaluateAmountExpression,
  formatMoney,
  formatMoneyParts,
  fromMinorUnits,
  intlLocale,
  toLocalDate,
  topUpSplitProblem,
  type JarSplit,
  type KeypadKey,
} from '@money-tracker/shared';
import { addTopUp, editTopUp, suggestedSplitOf, topUpJarsOf, walletOf } from '@/data/kidWallet';
import { useAccountSettings } from '@/data/useAccountSettings';
import { localDb, localStore } from '@/db/appDatabase';
import type { KidTransactionRow } from '@/db/schema';
import { useLanguage } from '@/i18n/useLanguage';
import { AmountEntryDisplay, AmountKeypad, Button, Card, IconCircle, ProgressBar, Screen, Text, useTypedAmountText } from '@/ui';
import { jarStyle, useKidWallet } from './useKidWallet';

export interface TopUpFormProps {
  kidProfileId: string;
  /** The Top-up being edited; a new one otherwise. */
  editing?: KidTransactionRow;
  header: ReactNode;
  /** Called once the Top-up is saved. */
  onSaved: () => void;
  /** More footer buttons under the main one (Skip, Delete). */
  footerExtra?: ReactNode;
}

type Target = 'total' | string;

/**
 * Top-up with a split across Jars (PDF page 11). One keypad types the total
 * or, after tapping a Jar, that Jar's share. Until a share is touched, the
 * split follows the suggestion (the last split, or all Spend) for the total.
 * Percentages are for display only; shares are whole minor units that must
 * add up exactly (design flaw 8), checked here and by the server.
 *
 * The keypad takes sums (`+ − × ÷`, ticket 08) for the total and each share.
 * Every sum is evaluated to whole minor units first, so the split check and
 * the suggestion only ever see results; Save waits while any sum is unfinished.
 */
export function TopUpForm({ kidProfileId, editing, header, onSaved, footerExtra }: TopUpFormProps) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { currency, numberingSystem } = useAccountSettings();
  const fractionDigits = currencyMinorDigits(currency);
  const { jarRows, transactions } = useKidWallet(kidProfileId);
  const accountId = localStore.accountId() ?? '';

  const [totalTyped, setTotalTyped] = useState(editing ? fromMinorUnits(editing.amount, currency) : '');
  const [sharesTyped, setSharesTyped] = useState<Record<string, string> | null>(() =>
    editing ? Object.fromEntries(editing.splits.map((s) => [s.jarId, fromMinorUnits(s.amount, currency)])) : null,
  );
  const [target, setTarget] = useState<Target>('total');

  // Null while the typed sum is unfinished, negative or divides by zero.
  const totalResult = evaluateNonNegativeAmount(totalTyped, currency);
  const total = totalResult ?? 0;
  // A Top-up being edited may still name a Jar archived since; keep showing it.
  const jars = useMemo(() => {
    const live = topUpJarsOf(jarRows);
    const named = new Set(Object.keys(sharesTyped ?? {}));
    return [...live, ...jarRows.filter((jar) => jar.archivedAt !== null && named.has(jar.id))];
  }, [jarRows, sharesTyped]);
  const keys = useMemo(() => new Map(walletOf(accountId, jarRows, []).jars.map((j) => [j.id, j.key])), [accountId, jarRows]);

  const others = transactions.filter((tx) => tx.id !== editing?.id);
  const suggestion = suggestedSplitOf(accountId, kidProfileId, jarRows, others, total);
  const shareResults: Record<string, number | null> | null = sharesTyped
    ? Object.fromEntries(Object.entries(sharesTyped).map(([id, text]) => [id, evaluateNonNegativeAmount(text, currency)]))
    : null;
  const sharesValid = !shareResults || Object.values(shareResults).every((amount) => amount !== null);
  const shares: Record<string, number> = shareResults
    ? Object.fromEntries(Object.entries(shareResults).map(([id, amount]) => [id, amount ?? 0]))
    : Object.fromEntries(suggestion.map((s) => [s.jarId, s.amount]));
  const splits: JarSplit[] = jars.map((jar) => ({ jarId: jar.id, amount: shares[jar.id] ?? 0 })).filter((s) => s.amount > 0);
  const sum = splits.reduce((acc, s) => acc + s.amount, 0);
  const allValid = totalResult !== null && sharesValid;
  const problem = total > 0 ? topUpSplitProblem(total, splits) : 'empty';
  const canSave = allValid && problem === null;

  const parts = (minor: number) => formatMoneyParts(minor, { language, currency, numberingSystem });
  const typedNumber = useTypedAmountText(numberingSystem);
  // Display only (design flaw 8), in the language's digits and percent sign.
  const percentFormat = useMemo(
    () => new Intl.NumberFormat(intlLocale(language, numberingSystem), { style: 'percent', maximumFractionDigits: 0 }),
    [language, numberingSystem],
  );
  const jarName = (id: string) => jars.find((j) => j.id === id)?.name ?? '';
  const spendJar = suggestion.length === 1 ? suggestion[0]!.jarId : null;
  const hasLastSplit = others.some((tx) => tx.kind === 'topUp');

  function press(key: KeypadKey) {
    const mode = { kind: 'expression', fractionDigits } as const;
    if (target === 'total') {
      setTotalTyped((current) => applyKeypadKey(current, key, mode));
      return;
    }
    const base =
      sharesTyped ?? Object.fromEntries(jars.map((jar) => [jar.id, shares[jar.id] ? fromMinorUnits(shares[jar.id]!, currency) : '']));
    setSharesTyped({ ...base, [target]: applyKeypadKey(base[target] ?? '', key, mode) });
  }

  function save() {
    if (!canSave) return;
    const result = editing
      ? editTopUp(localStore, localDb, editing.id, { amount: total, splits })
      : addTopUp(localStore, { kidProfileId, amount: total, splits, date: toLocalDate(new Date()) });
    if (result.status === 'ok' || result.status === 'deleted') onSaved();
  }

  let caption: { text: string; tone: 'muted' | 'negative' } | null = null;
  if (sharesTyped && allValid && total > 0 && sum !== total) {
    caption = { text: t('kid.topUp.mismatch', { sum: parts(sum).amount, total: parts(total).amount }), tone: 'negative' };
  } else if (!sharesTyped && total > 0) {
    caption = {
      text: hasLastSplit ? t('kid.topUp.sameAsLast') : t('kid.topUp.allTo', { jar: spendJar ? jarName(spendJar) : '' }),
      tone: 'muted',
    };
  }

  const totalLabel = parts(total);
  return (
    <Screen
      scroll
      footer={
        <>
          <AmountKeypad entry={{ press, showDecimal: fractionDigits > 0 }} numberingSystem={numberingSystem} />
          <Button
            label={editing ? t('kid.topUp.saveEdit') : t('kid.topUp.save', { amount: totalLabel.amount })}
            disabled={!canSave}
            onPress={save}
          />
          {footerExtra}
        </>
      }
    >
      {header}
      <Card
        selected={target === 'total'}
        onPress={() => setTarget('total')}
        accessibilityLabel={t('home.figure', {
          label: t('kid.topUp.amountLabel'),
          amount: totalResult === null ? typedNumber(totalTyped) : formatMoney(total, { language, currency, numberingSystem }),
        })}
        className="py-2"
      >
        <AmountEntryDisplay
          entry={{ typed: totalTyped, result: evaluateAmountExpression(totalTyped, currency) }}
          currency={currency}
          numberingSystem={numberingSystem}
        />
      </Card>

      <View className="gap-1">
        <Text weight="semibold" tone="muted" className="text-sm">
          {t('kid.topUp.splitLabel')}
        </Text>
        <Text tone="muted" className="text-xs">
          {t('kid.topUp.editHint')}
        </Text>
      </View>
      <View className="gap-2">
        {jars.map((jar) => {
          const share = shares[jar.id] ?? 0;
          const percent = percentFormat.format(total > 0 ? Math.round((share / total) * 100) / 100 : 0);
          const style = jarStyle(keys.get(jar.id) ?? null);
          const shown = target === jar.id && sharesTyped ? typedNumber(sharesTyped[jar.id] ?? '') : parts(share).amount;
          return (
            <Card
              key={jar.id}
              selected={target === jar.id}
              onPress={() => setTarget(jar.id)}
              accessibilityLabel={t('kid.topUp.shareLabel', { jar: jar.name, amount: parts(share).amount, percent })}
              className="flex-row items-center gap-3 px-3 py-3"
            >
              <IconCircle icon={style.icon} tone="tint" />
              <View className="flex-1 gap-1.5">
                <Text weight="semibold" numberOfLines={1}>
                  {jar.name}
                </Text>
                <ProgressBar progress={total > 0 ? share / total : 0} tone="primary" />
              </View>
              <Text weight="bold" className="text-base">
                {`${percent} · ${shown}`}
              </Text>
            </Card>
          );
        })}
      </View>
      {caption ? (
        <Text tone={caption.tone} align="center" className="text-sm">
          {caption.text}
        </Text>
      ) : null}
      {sharesTyped ? (
        <Button
          label={t('kid.topUp.reset')}
          variant="secondary"
          onPress={() => {
            setSharesTyped(null);
            setTarget('total');
          }}
        />
      ) : null}
    </Screen>
  );
}
