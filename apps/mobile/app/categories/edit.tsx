import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CATEGORY_NAME_MAX_LENGTH, currentMonth, formatMonth, fromMinorUnits } from '@money-tracker/shared';
import { categoryBudgetsQuery, setCategoryBudgets } from '@/data/budget';
import { allCategoriesQuery, categoryActions, categoryNameOf } from '@/data/categories';
import { useAccountSettings } from '@/data/useAccountSettings';
import { localDb, localStore } from '@/db/appDatabase';
import { useLanguage } from '@/i18n/useLanguage';
import { AmountEntryDisplay, AmountKeypad, Button, Card, Screen, ScreenHeader, Text, TextField, useAmountEntry } from '@/ui';

const actions = categoryActions(localStore, localDb);

/**
 * Add a Category, or rename one and set its Category Budget for the Month.
 * Other keeps its name and can't be archived; only its budget changes here.
 * The budget is typed on the adult keypad, which takes sums (`+ − × ÷`).
 */
export default function EditCategoryScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const params = useLocalSearchParams<{ id?: string; month?: string }>();
  const month = params.month ?? currentMonth(new Date());
  const { currency, numberingSystem } = useAccountSettings();
  const monthName = formatMonth(month, { language, numberingSystem });

  // Read once: this screen edits a snapshot, saved with Save.
  const [existing] = useState(() => (params.id ? allCategoriesQuery(localDb).all().find((c) => c.id === params.id) : undefined));
  const [initialBudget] = useState(() => {
    const amount = existing ? categoryBudgetsQuery(localDb, month).all().find((b) => b.categoryId === existing.id)?.amount : undefined;
    return amount ? fromMinorUnits(amount, currency) : '';
  });
  const [name, setName] = useState(existing?.name ?? '');
  const budgetEntry = useAmountEntry(currency, initialBudget);

  const isOther = existing?.isOther ?? false;
  const validName = isOther ? existing!.name : categoryNameOf(name);
  // Nothing typed is 0; a negative result or an unfinished sum can't be saved.
  const budget = budgetEntry.allocation;
  const canSave = validName !== null && budget !== null;

  function save() {
    if (!canSave) return;
    const id = existing ? existing.id : actions.add(validName);
    if (existing && !isOther && validName !== existing.name) actions.rename(id, validName);
    if (budgetEntry.typed !== initialBudget) setCategoryBudgets(localStore, month, { [id]: budget });
    router.back();
  }

  function archive() {
    if (existing) actions.archive(existing.id);
    router.back();
  }

  return (
    <Screen
      scroll
      footer={
        <>
          <AmountKeypad entry={budgetEntry} numberingSystem={numberingSystem} />
          <Button label={t('categories.save')} disabled={!canSave} onPress={save} />
          {existing && !isOther ? <Button label={t('categories.archive')} variant="secondary" icon="app:archive" onPress={archive} /> : null}
        </>
      }
    >
      <ScreenHeader
        title={isOther ? t('categories.other') : existing ? t('categories.editTitle') : t('categories.newTitle')}
        onBack={() => router.back()}
      />
      {isOther ? (
        <Text tone="muted">{t('categories.otherLocked')}</Text>
      ) : (
        <View className="gap-1">
          <TextField
            label={t('categories.nameLabel')}
            value={name}
            onChangeText={setName}
            maxLength={CATEGORY_NAME_MAX_LENGTH}
            autoFocus={!existing}
          />
          {name !== '' && validName === null ? (
            <Text tone="negative" className="text-sm">
              {t('categories.nameInvalid', { max: CATEGORY_NAME_MAX_LENGTH })}
            </Text>
          ) : null}
        </View>
      )}
      <View className="gap-1">
        <Text tone="muted" className="text-xs">
          {t('categories.budgetLabel', { month: monthName })}
        </Text>
        <Card className="py-2">
          <AmountEntryDisplay
            entry={budgetEntry}
            currency={currency}
            numberingSystem={numberingSystem}
            accessibilityLabel={t('categories.budgetLabel', { month: monthName })}
          />
        </Card>
        {budget === null && budgetEntry.result.status === 'ok' ? (
          <Text tone="negative" className="text-sm">
            {t('categories.budgetInvalid')}
          </Text>
        ) : null}
      </View>
      {existing && !isOther ? (
        <Text tone="muted" className="text-sm">
          {t('categories.archiveHint')}
        </Text>
      ) : null}
    </Screen>
  );
}
