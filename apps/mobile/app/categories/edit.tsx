import { useMemo, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { CATEGORY_NAME_MAX_LENGTH, currentMonth, formatMonth, fromMinorUnits, guessCategoryIcon } from '@money-tracker/shared';
import { CategoryIconPicker } from '@/categories/CategoryIconPicker';
import { useConfirmDeleteCategory } from '@/categories/useConfirmDeleteCategory';
import { categoryBudgetsQuery, setCategoryBudgets } from '@/data/budget';
import { activeCategoriesQuery, allCategoriesQuery, categoryActions, categoryNameOf } from '@/data/categories';
import { categoryIconFor } from '@/data/categoryIcons';
import { useAccountSettings } from '@/data/useAccountSettings';
import { localDb, localStore } from '@/db/appDatabase';
import { useLanguage } from '@/i18n/useLanguage';
import { AmountEntryDisplay, AmountKeypad, Button, Card, Screen, ScreenHeader, Text, TextField, useAmountEntry, useKeyboardVisible } from '@/ui';

const actions = categoryActions(localStore, localDb);

/**
 * Add a Category, or rename one, change its icon, set its Category Budget for
 * the Month, archive or delete it. While adding, the icon follows the typed
 * name until the adult picks one; renaming never changes it. Other keeps its
 * name and icon and can't be archived or deleted; only its budget changes
 * here. The last active Category besides Other can't be archived or deleted.
 * The budget is typed on the adult keypad, which takes sums (`+ − × ÷`).
 * While the system keyboard is open for the name, the keypad is hidden so the
 * keyboard can't cover it; tapping the budget closes the keyboard.
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
  // The icon it shows now (for older records, the fallback); a new Category's follows the name until picked.
  const [initialIcon] = useState(() => (existing ? categoryIconFor(localStore.accountId())(existing).slice(4) : null));
  const [pickedIcon, setPickedIcon] = useState<string | null>(initialIcon);
  const icon = pickedIcon ?? guessCategoryIcon(name);
  const { data: active } = useLiveQuery(activeCategoriesQuery(localDb));
  const confirmDelete = useConfirmDeleteCategory();
  const typingName = useKeyboardVisible();

  const isOther = existing?.isOther ?? false;
  const validName = isOther ? existing!.name : categoryNameOf(name);
  // Nothing typed is 0; a negative result or an unfinished sum can't be saved.
  const budget = budgetEntry.nonNegative;
  const canSave = validName !== null && budget !== null;
  // Archived or not, from the live list: it's the last one if no other active Category but Other is left.
  const isLast = useMemo(
    () => !!existing && existing.archivedAt === null && !active.some((c) => !c.isOther && c.id !== existing.id),
    [active, existing],
  );

  function save() {
    if (!canSave) return;
    const id = existing ? existing.id : actions.add(validName, icon);
    if (existing && !isOther && validName !== existing.name) actions.rename(id, validName);
    if (existing && !isOther && icon !== initialIcon) actions.setIcon(id, icon);
    if (budgetEntry.typed !== initialBudget) setCategoryBudgets(localStore, month, { [id]: budget });
    router.back();
  }

  function archive() {
    if (existing) actions.archive(existing.id);
    router.back();
  }

  function remove() {
    if (existing) confirmDelete(existing, month, () => router.back());
  }

  return (
    <Screen
      scroll
      footer={
        <>
          {typingName ? null : <AmountKeypad entry={budgetEntry} numberingSystem={numberingSystem} />}
          <Button label={t('categories.save')} disabled={!canSave} onPress={save} />
          {existing && !isOther ? (
            <View className="flex-row gap-2">
              <Button
                label={t('categories.archive')}
                variant="secondary"
                icon="app:archive"
                disabled={isLast || existing.archivedAt !== null}
                onPress={archive}
                className="flex-1"
              />
              <Button label={t('categories.delete')} variant="danger" icon="app:delete" disabled={isLast} onPress={remove} className="flex-1" />
            </View>
          ) : null}
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
        <Pressable onPress={() => Keyboard.dismiss()}>
          <Card className="py-2">
            <AmountEntryDisplay
              entry={budgetEntry}
              currency={currency}
              numberingSystem={numberingSystem}
              accessibilityLabel={t('categories.budgetLabel', { month: monthName })}
            />
          </Card>
        </Pressable>
        {budget === null && budgetEntry.result.status === 'ok' ? (
          <Text tone="negative" className="text-sm">
            {t('categories.budgetInvalid')}
          </Text>
        ) : null}
      </View>
      {isOther ? null : <CategoryIconPicker value={icon} onChange={setPickedIcon} />}
      {existing && !isOther ? (
        <Text tone="muted" className="text-sm">
          {isLast ? t('categories.lastCategory') : t('categories.archiveHint')}
        </Text>
      ) : null}
    </Screen>
  );
}
