import { useMemo } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useTranslation } from 'react-i18next';
import { currentMonth, formatMonth } from '@money-tracker/shared';
import { useConfirmDeleteCategory } from '@/categories/useConfirmDeleteCategory';
import { activeCategoriesQuery, archivedCategoriesQuery, categoryActions } from '@/data/categories';
import { categoryIconFor } from '@/data/categoryIcons';
import { useAccountSettings } from '@/data/useAccountSettings';
import { useMonthBudget } from '@/data/useMonthBudget';
import { localDb, localStore } from '@/db/appDatabase';
import { useFormatMoney } from '@/i18n/useFormatMoney';
import { useLanguage } from '@/i18n/useLanguage';
import { useTheme } from '@/theme/ThemeProvider';
import { Button, Card, Glyph, IconButton, IconCircle, ListRow, Screen, ScreenHeader, Text } from '@/ui';

const actions = categoryActions(localStore, localDb);

/**
 * Categories and budgets (PDF page 7): this Month's Expected Income and
 * Unallocated, then each active Category with its budget for the Month (named,
 * design flaw 7). Tap a row to rename it, set its budget or archive it; the
 * arrows reorder. Other is locked last (only its budget can change). Archived
 * Categories can be restored or deleted.
 */
export default function CategoriesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const language = useLanguage();
  const { currency, numberingSystem } = useAccountSettings();
  const formatMoney = useFormatMoney(numberingSystem);
  const params = useLocalSearchParams<{ month?: string }>();
  const month = params.month ?? currentMonth(new Date());
  const monthName = formatMonth(month, { language, numberingSystem });
  const { figures, rows } = useMonthBudget(month);
  const { data: active } = useLiveQuery(activeCategoriesQuery(localDb));
  const { data: archived } = useLiveQuery(archivedCategoriesQuery(localDb));
  const iconOf = useMemo(() => categoryIconFor(localStore.accountId()), []);
  const confirmDelete = useConfirmDeleteCategory();
  const budgetOf = useMemo(() => new Map(rows.map((row) => [row.categoryId, row.budget])), [rows]);

  const movable = active.filter((c) => !c.isOther);
  const nameOf = (category: { isOther: boolean; name: string }) => (category.isOther ? t('categories.other') : category.name);

  function move(index: number, by: -1 | 1) {
    const ids = movable.map((c) => c.id);
    const target = index + by;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    actions.reorder(ids);
  }

  const edit = (id?: string) => router.push({ pathname: '/categories/edit', params: id ? { id, month } : { month } });

  return (
    <Screen scroll footer={<Button label={t('categories.add')} icon="app:add" onPress={() => edit()} />}>
      <ScreenHeader title={t('categories.title')} onBack={() => router.back()} />
      <Text tone="muted">{t('categories.subtitle', { month: monthName })}</Text>

      <Card onPress={() => router.push({ pathname: '/categories/income', params: { month } })} accessibilityLabel={t('categories.editExpectedIncome')} className="gap-2 p-4">
        <View className="flex-row items-center justify-between gap-2">
          <Text tone="muted">{t('categories.expectedIncome')}</Text>
          <View className="flex-row items-center gap-2">
            <Text weight="bold">{formatMoney(figures.expectedIncome, currency)}</Text>
            <Glyph name="app:edit" size={16} color={theme.colors.primary} />
          </View>
        </View>
        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-row items-center gap-2">
            <Glyph
              name={figures.unallocated < 0 ? 'app:gentle-warning' : 'app:unallocated'}
              size={16}
              color={figures.unallocated < 0 ? theme.colors.negative : theme.colors.primary}
            />
            <Text tone="muted">{t('home.unallocated')}</Text>
          </View>
          <Text weight="bold" tone={figures.unallocated < 0 ? 'negative' : 'text'}>
            {formatMoney(figures.unallocated, currency)}
          </Text>
        </View>
      </Card>

      <View className="gap-2">
        {active.map((category) => {
          const index = movable.findIndex((c) => c.id === category.id);
          const name = nameOf(category);
          return (
            <Card
              key={category.id}
              onPress={() => edit(category.id)}
              accessibilityLabel={name}
              className="flex-row items-center gap-3 px-3 py-2"
            >
              <IconCircle icon={iconOf(category)} size="sm" />
              <Text weight="semibold" numberOfLines={1} className="flex-1 text-base">
                {name}
              </Text>
              <Text weight="bold">{formatMoney(budgetOf.get(category.id) ?? 0, currency)}</Text>
              {category.isOther ? (
                <View accessible accessibilityLabel={t('categories.otherLocked')} className="h-11 w-11 items-center justify-center">
                  <Glyph name="app:lock-pin" size={18} color={theme.colors.muted} />
                </View>
              ) : (
                <View className="flex-row">
                  <IconButton
                    icon="app:chevron-up"
                    accessibilityLabel={t('categories.moveUp', { name })}
                    onPress={() => move(index, -1)}
                    disabled={index === 0}
                  />
                  <IconButton
                    icon="app:chevron-down"
                    accessibilityLabel={t('categories.moveDown', { name })}
                    onPress={() => move(index, 1)}
                    disabled={index === movable.length - 1}
                  />
                </View>
              )}
            </Card>
          );
        })}
      </View>

      {archived.length > 0 ? (
        <View className="gap-2">
          <Text weight="semibold" tone="muted" accessibilityRole="header">
            {t('categories.archived')}
          </Text>
          {archived.map((category) => (
            <ListRow
              key={category.id}
              icon={iconOf(category)}
              title={category.name}
              end={
                <View className="flex-row gap-1">
                  <Button label={t('categories.restore')} variant="secondary" icon="app:restore" onPress={() => actions.restore(category.id)} />
                  <IconButton
                    icon="app:delete"
                    accessibilityLabel={t('categories.deleteTitle', { name: category.name })}
                    onPress={() => confirmDelete(category, month)}
                  />
                </View>
              }
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
