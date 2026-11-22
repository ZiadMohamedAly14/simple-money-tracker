import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useTranslation } from 'react-i18next';
import { toLocalDate, type TransactionKind } from '@money-tracker/shared';
import { categoryIconFor } from '@/data/categoryIcons';
import { allCategoriesQuery, categoryChoicesQuery, shownCategoryOf } from '@/data/categories';
import { useAccountSettings } from '@/data/useAccountSettings';
import { localDb, localStore } from '@/db/appDatabase';
import {
  AmountEntryDisplay,
  AmountKeypad,
  Button,
  Chip,
  DateField,
  Screen,
  ScreenHeader,
  TextField,
  useAmountEntry,
} from '@/ui';

export interface TransactionValues {
  /** Positive, in minor units: the keypad sum's result. */
  amount: number;
  /** Local date `YYYY-MM-DD`. */
  date: string;
  note: string | null;
  /** The Expense's Category; null for Income. */
  categoryId: string | null;
}

export interface TransactionFormProps {
  kind: TransactionKind;
  title: string;
  /** The amount as decimal text (fromMinorUnits) and the other fields, when editing. */
  initial?: { amount: string; date: string; note: string | null; categoryId: string | null };
  /** The date a new Transaction starts with; today if not given. */
  defaultDate?: string;
  /** The Category a new Expense starts with (tapping a Category on home). */
  defaultCategoryId?: string;
  onSave: (values: TransactionValues) => void;
  onClose: () => void;
  /** Shows a Delete button (editing). */
  onDelete?: () => void;
}

/**
 * Recording or editing an Income or Expense (PDF pages 1–2). The keypad is
 * always on screen, so typing starts at once; an Expense takes a Category chip
 * (most recently used first), so a new one is +, amount, chip, Save. The date
 * defaults to today and the note is optional. Income has no Category.
 */
export function TransactionForm({ kind, title, initial, defaultDate, defaultCategoryId, onSave, onClose, onDelete }: TransactionFormProps) {
  const { t } = useTranslation();
  const { currency, numberingSystem } = useAccountSettings();
  const entry = useAmountEntry(currency, initial?.amount);
  const [date, setDate] = useState(initial?.date ?? defaultDate ?? toLocalDate(new Date()));
  const [note, setNote] = useState(initial?.note ?? '');
  const [chosenId, setCategoryId] = useState<string | null>(initial?.categoryId ?? defaultCategoryId ?? null);
  const { data: choices } = useLiveQuery(categoryChoicesQuery(localDb));
  const { data: allCategories } = useLiveQuery(allCategoriesQuery(localDb));
  // An Expense whose Category is deleted (maybe on another device) shows, and saves, as Other.
  const categoryId = useMemo(
    () => (chosenId && allCategories.length > 0 ? (shownCategoryOf(allCategories)(chosenId)?.id ?? chosenId) : chosenId),
    [chosenId, allCategories],
  );

  // An edited Expense keeps its Category even if that has since been archived.
  const chips = useMemo(() => {
    if (!categoryId || choices.some((c) => c.id === categoryId)) return choices;
    const current = allCategories.find((c) => c.id === categoryId);
    return current ? [current, ...choices] : choices;
  }, [choices, allCategories, categoryId]);

  const iconFor = useMemo(() => categoryIconFor(localStore.accountId()), []);
  const isExpense = kind === 'expense';
  const canSave = entry.amount !== null && (!isExpense || categoryId !== null);

  function save() {
    if (entry.amount === null || (isExpense && !categoryId)) return;
    onSave({ amount: entry.amount, date, note: note.trim() || null, categoryId: isExpense ? categoryId : null });
  }

  return (
    <Screen
      footer={
        <>
          <AmountKeypad entry={entry} numberingSystem={numberingSystem} />
          <Button label={t('transactions.save')} disabled={!canSave} onPress={save} />
          {onDelete ? <Button label={t('transactions.delete')} variant="danger" icon="app:delete" onPress={onDelete} /> : null}
        </>
      }
    >
      <ScreenHeader title={title} onBack={onClose} backIcon="close" />
      <View className="flex-1 justify-center gap-4">
        <AmountEntryDisplay
          entry={entry}
          currency={currency}
          numberingSystem={numberingSystem}
          accessibilityLabel={t('transactions.amountLabel')}
        />
        {isExpense ? (
          // Every Category in view at once, wrapping onto more rows; it only scrolls
          // (vertically) when there are too many to fit above the keypad.
          <ScrollView
            accessibilityLabel={t('transactions.category')}
            contentContainerClassName="flex-row flex-wrap justify-center gap-2"
            className="shrink grow-0"
          >
            {chips.map((category) => (
              <Chip
                key={category.id}
                label={category.isOther ? t('categories.other') : category.name}
                icon={iconFor(category)}
                selected={category.id === categoryId}
                onPress={() => setCategoryId(category.id)}
              />
            ))}
          </ScrollView>
        ) : null}
        <View className="flex-row items-center gap-3">
          <DateField value={date} onChange={setDate} numberingSystem={numberingSystem} />
          <TextField
            value={note}
            onChangeText={setNote}
            placeholder={`${t('transactions.note')} (${t('transactions.notePlaceholder')})`}
            accessibilityLabel={t('transactions.note')}
            maxLength={200}
            returnKeyType="done"
            className="flex-1"
          />
        </View>
      </View>
    </Screen>
  );
}
