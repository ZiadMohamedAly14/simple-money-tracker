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
  balancingJarOf,
  customSplit,
  defaultJarId,
  presetOf,
  presetSplit,
  type KeypadKey,
  type TopUpPreset,
} from '@money-tracker/shared';
import { addTopUp, editTopUp, topUpJarsOf, walletOf } from '@/data/kidWallet';
import { useAccountSettings } from '@/data/useAccountSettings';
import { localDb, localStore } from '@/db/appDatabase';
import type { KidTransactionRow } from '@/db/schema';
import { useLanguage } from '@/i18n/useLanguage';
import { AmountEntryDisplay, AmountKeypad, Button, Card, Caret, Chip, IconCircle, ProgressBar, Screen, Text, useTypedAmountText } from '@/ui';
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
type Choice = TopUpPreset | 'custom';

/** Shares typed in Custom, as keypad text, and the total they were typed against. */
interface CustomTyped {
  base: number;
  typed: Record<string, string>;
}

/**
 * Top-up with a split across Jars (PDF page 11). The keypad types the total,
 * and a preset below it splits it: All to Spend, Split evenly, Same as last
 * time, or Custom. The form opens on the preset the last Top-up matched
 * (Same as last time if it matched none; All to Spend for the first one).
 * In Custom, tapping a Jar makes the keypad type its share and Spend takes
 * the rest, so the shares can never fall short of the total; going over is
 * shown and blocks Save. Percentages are for display only; shares are whole
 * minor units that add up exactly (design flaw 8), checked here and by the
 * server.
 *
 * The keypad takes sums (`+ − × ÷`, ticket 08) for the total and each share.
 * Every sum is evaluated to whole minor units first; Save waits while any sum
 * is unfinished. Tapping the total or a Jar selects its whole amount, like
 * select-all in a text field: the first digit replaces it.
 */
export function TopUpForm({ kidProfileId, editing, header, onSaved, footerExtra }: TopUpFormProps) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { currency, numberingSystem } = useAccountSettings();
  const fractionDigits = currencyMinorDigits(currency);
  const { jarRows, transactions } = useKidWallet(kidProfileId);
  const accountId = localStore.accountId() ?? '';

  const [totalTyped, setTotalTyped] = useState(editing ? fromMinorUnits(editing.amount, currency) : '');
  // Null until the parent picks one; the default is worked out on each render, since the Jars load after the first.
  const [chosen, setChosen] = useState<Choice | null>(null);
  const [customState, setCustomState] = useState<CustomTyped | null>(null);
  const [target, setTarget] = useState<Target>('total');
  // The target's amount is "selected" right after it is tapped: the next digit replaces it rather than appending.
  const [replaceNext, setReplaceNext] = useState(false);

  // Null while the typed sum is unfinished, negative or divides by zero.
  const totalResult = evaluateNonNegativeAmount(totalTyped, currency);
  const total = totalResult ?? 0;
  const liveIds = useMemo(() => topUpJarsOf(jarRows).map((jar) => jar.id), [jarRows]);
  // A Top-up being edited may still name a Jar archived since; keep showing it.
  const jars = useMemo(() => {
    const named = new Set((editing?.splits ?? []).map((s) => s.jarId));
    return [...topUpJarsOf(jarRows), ...jarRows.filter((jar) => jar.archivedAt !== null && named.has(jar.id))];
  }, [jarRows, editing]);
  const keys = useMemo(() => new Map(walletOf(accountId, jarRows, []).jars.map((j) => [j.id, j.key])), [accountId, jarRows]);
  const spendJarId = defaultJarId(accountId, kidProfileId, 'spend');
  const sink = balancingJarOf(liveIds.length > 0 ? liveIds : jars.map((jar) => jar.id), spendJarId);

  // The Top-up before this one: the newest, or for an edit the newest older than it (transactions are newest first).
  const editingIndex = editing ? transactions.findIndex((tx) => tx.id === editing.id) : -1;
  const last = transactions.find((tx, i) => i > editingIndex && tx.id !== editing?.id && tx.kind === 'topUp');
  const presetOptions = { jarIds: liveIds, spendJarId, lastSplit: last?.splits ?? null };
  // "Same as last time" is only offered when it differs from the other presets.
  const lastPreset = last ? presetOf(last.amount, last.splits, { ...presetOptions, lastSplit: null }) : null;
  const editingPreset = editing ? presetOf(editing.amount, editing.splits, presetOptions) : null;
  const choice: Choice = chosen ?? (editing ? (editingPreset ?? 'custom') : last ? (lastPreset ?? 'sameAsLast') : 'allToSpend');
  const choices: Choice[] = ['allToSpend', 'evenly', ...(last && (lastPreset === null || choice === 'sameAsLast') ? (['sameAsLast'] as const) : []), 'custom'];

  const custom: CustomTyped = customState ?? {
    base: editing?.amount ?? total,
    typed: Object.fromEntries((editing?.splits ?? []).map((s) => [s.jarId, fromMinorUnits(s.amount, currency)])),
  };
  const customResults = Object.fromEntries(
    Object.entries(custom.typed).map(([id, text]) => [id, text === '' ? 0 : evaluateNonNegativeAmount(text, currency)]),
  );
  const customValid = choice !== 'custom' || Object.entries(customResults).every(([id, amount]) => id === sink || amount !== null);
  const customShares = Object.fromEntries(Object.entries(customResults).map(([id, amount]) => [id, amount ?? 0]));
  const { splits, over } =
    choice === 'custom'
      ? customSplit(total, { total: custom.base, shares: customShares }, { jarIds: jars.map((jar) => jar.id), spendJarId: sink })
      : { splits: presetSplit(choice, total, presetOptions), over: 0 };
  const shares = Object.fromEntries(splits.map((s) => [s.jarId, s.amount]));
  const sum = splits.reduce((acc, s) => acc + s.amount, 0);
  const allValid = totalResult !== null && customValid;
  const problem = total > 0 ? topUpSplitProblem(total, splits) : 'empty';
  const canSave = allValid && over === 0 && problem === null;

  const parts = (minor: number) => formatMoneyParts(minor, { language, currency, numberingSystem });
  const typedNumber = useTypedAmountText(numberingSystem);
  // Display only (design flaw 8), in the language's digits and percent sign.
  const percentFormat = useMemo(
    () => new Intl.NumberFormat(intlLocale(language, numberingSystem), { style: 'percent', maximumFractionDigits: 0 }),
    [language, numberingSystem],
  );
  const sinkName = jars.find((j) => j.id === sink)?.name ?? '';

  /**
   * The Custom shares typed against the current total, as keypad text (Spend
   * left out). While the total is empty or an unfinished sum, the shares stay
   * as typed rather than scaling to nothing.
   */
  function customAtTotal(): CustomTyped {
    if (customState && (customState.base === total || total === 0)) return customState;
    const typed = Object.fromEntries(
      jars.filter((jar) => jar.id !== sink).map((jar) => [jar.id, shares[jar.id] ? fromMinorUnits(shares[jar.id]!, currency) : '']),
    );
    return { base: total, typed };
  }

  function choose(next: Choice) {
    if (next === 'custom' && choice !== 'custom') setCustomState(customAtTotal());
    setChosen(next);
    setTarget('total');
    setReplaceNext(false);
  }

  function tapJar(jarId: string) {
    if (choice !== 'custom' || jarId === sink) return;
    setChosen('custom');
    setCustomState(customAtTotal());
    selectTarget(jarId);
  }

  function selectTarget(next: Target) {
    setTarget(next);
    setReplaceNext(true);
  }

  function press(key: KeypadKey) {
    const mode = { kind: 'expression', fractionDigits } as const;
    // While selected, a digit, decimal point or backspace replaces the amount; an operator builds on it.
    const type = (typed: string) =>
      !replaceNext ? applyKeypadKey(typed, key, mode) : key === 'backspace' ? '' : applyKeypadKey(/^\d$|^decimal$/.test(key) ? '' : typed, key, mode);
    setReplaceNext(false);
    if (target === 'total') {
      setTotalTyped(type(totalTyped));
      return;
    }
    const current = customAtTotal();
    setCustomState({ ...current, typed: { ...current.typed, [target]: type(current.typed[target] ?? '') } });
  }

  function save() {
    if (!canSave) return;
    const result = editing
      ? editTopUp(localStore, localDb, editing.id, { amount: total, splits })
      : addTopUp(localStore, { kidProfileId, amount: total, splits, date: toLocalDate(new Date()) });
    if (result.status === 'ok' || result.status === 'deleted') onSaved();
  }

  const choiceLabel = (c: Choice) =>
    c === 'allToSpend' ? t('kid.topUp.allTo', { jar: sinkName }) : t(`kid.topUp.${c}`);

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
        onPress={() => selectTarget('total')}
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
          selected={target === 'total' && replaceNext}
        />
      </Card>

      <View className="gap-2">
        <Text weight="semibold" tone="muted" className="text-sm">
          {t('kid.topUp.splitLabel')}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {choices.map((c) => (
            <Chip key={c} label={choiceLabel(c)} selected={c === choice} onPress={() => choose(c)} />
          ))}
        </View>
        {choice === 'custom' ? (
          <Text tone="muted" className="text-xs">
            {t('kid.topUp.editHint', { jar: sinkName })}
          </Text>
        ) : null}
      </View>
      <View className="gap-2">
        {jars.map((jar) => {
          const share = shares[jar.id] ?? 0;
          const percent = percentFormat.format(total > 0 ? Math.round((share / total) * 100) / 100 : 0);
          const style = jarStyle(keys.get(jar.id) ?? null);
          const typing = choice === 'custom' && target === jar.id;
          const shown = typing ? typedNumber(custom.typed[jar.id] ?? '') : parts(share).amount;
          const isSink = jar.id === sink;
          const editable = choice === 'custom' && !isSink;
          return (
            <Card
              key={jar.id}
              selected={typing}
              onPress={editable ? () => tapJar(jar.id) : undefined}
              accessibilityLabel={t('kid.topUp.shareLabel', { jar: jar.name, amount: parts(share).amount, percent })}
              className="flex-row items-center gap-3 px-3 py-3"
            >
              <IconCircle icon={style.icon} tone="tint" />
              <View className="flex-1 gap-1.5">
                <Text weight="semibold" numberOfLines={1}>
                  {choice === 'custom' && isSink ? t('kid.topUp.theRest', { jar: jar.name }) : jar.name}
                </Text>
                <ProgressBar progress={total > 0 ? share / total : 0} tone="primary" />
              </View>
              <View style={{ flexDirection: 'row', direction: 'ltr' }} className="items-center">
                <Text weight="bold" className="text-base">
                  {`${percent} · `}
                </Text>
                <View className={typing && replaceNext ? 'rounded bg-primary/20' : undefined}>
                  <Text weight="bold" className="text-base">
                    {shown}
                  </Text>
                </View>
                {typing && !replaceNext ? <Caret size="sm" /> : null}
              </View>
            </Card>
          );
        })}
      </View>
      {over > 0 && total > 0 && allValid ? (
        <Text tone="negative" align="center" className="text-sm">
          {t('kid.topUp.over', { sum: parts(sum).amount, total: parts(total).amount })}
        </Text>
      ) : null}
    </Screen>
  );
}
