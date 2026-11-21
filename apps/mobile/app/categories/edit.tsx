import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CATEGORY_NAME_MAX_LENGTH, currentMonth, formatMonth, fromMinorUnits, toMinorUnits } from '@money-tracker/shared';
import { categoryBudgetsQuery, setCategoryBudgets } from '@/data/budget';
import { allCategoriesQuery, categoryActions, categoryNameOf } from '@/data/categories';
import { useAccountSettings } from '@/data/useAccountSettings';
import { localDb, localStore } from '@/db/appDatabase';
import { useLanguage } from '@/i18n/useLanguage';
import { Button, Screen, ScreenHeader, Text, TextField } from '@/ui';

const actions = categoryActions(localStore, localDb);

/**
 * Add a Category, or rename one and set its Category Budget for the Month.
 * Other keeps its name and can't be archived; only its budget changes here.
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
  const [budgetText, setBudgetText] = useState(initialBudget);

  const isOther = existing?.isOther ?? false;
  const validName = isOther ? existing!.name : categoryNameOf(name);
  const budget = budgetText.trim() ? toMinorUnits(budgetText, currency) : 0;
  const canSave = validName !== null && budget !== null;

  function save() {
    if (!canSave) return;
    const id = existing ? existing.id : actions.add(validName);
    if (existing && !isOther && validName !== existing.name) actions.rename(id, validName);
    if (budgetText !== initialBudget) setCategoryBudgets(localStore, month, { [id]: budget });
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
        <TextField
          label={t('categories.budgetLabel', { month: monthName })}
          value={budgetText}
          onChangeText={setBudgetText}
          placeholder="0"
          keyboardType="decimal-pad"
        />
        {budget === null ? (
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
