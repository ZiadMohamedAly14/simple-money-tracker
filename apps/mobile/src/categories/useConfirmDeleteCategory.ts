import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { intlLocale, type Month } from '@money-tracker/shared';
import { categoryActions, categoryDeletionImpact } from '@/data/categories';
import { useAccountSettings } from '@/data/useAccountSettings';
import { localDb, localStore } from '@/db/appDatabase';
import { useLanguage } from '@/i18n/useLanguage';
import { showDialog, type DialogButton } from '@/ui/dialogStore';

const actions = categoryActions(localStore, localDb);

/**
 * Asks before deleting a Category, then deletes it. With no Expenses it's a
 * plain "Delete 'X'?". Otherwise it says how many Expenses (all Months) move
 * to Other with totals unchanged, that this Month's budget goes back to
 * Unallocated (only if it has one), and that there's no undo while Archive
 * keeps the history; it offers Archive instead (unless already Archived).
 * `done` runs after either choice.
 */
export function useConfirmDeleteCategory() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { numberingSystem } = useAccountSettings();

  return useCallback(
    (category: { id: string; name: string; archivedAt: number | null }, month: Month, done?: () => void) => {
      const { expenseCount, hasBudgetThisMonth } = categoryDeletionImpact(localDb, category.id, month);
      const title = t('categories.deleteTitle', { name: category.name });
      const remove: DialogButton = {
        text: t('categories.delete'),
        style: 'destructive',
        onPress: () => {
          actions.remove(category.id);
          done?.();
        },
      };
      const cancel: DialogButton = { text: t('common.cancel'), style: 'cancel' };
      if (expenseCount === 0) {
        showDialog(title, undefined, [cancel, remove]);
        return;
      }
      const count = new Intl.NumberFormat(intlLocale(language, numberingSystem)).format(expenseCount);
      const body = [
        t('categories.deleteMoves', { count }),
        hasBudgetThisMonth ? t('categories.deleteBudget') : null,
        t('categories.deleteFinal'),
      ]
        .filter((line) => line !== null)
        .join('\n\n');
      const archiveInstead: DialogButton = {
        text: t('categories.archiveInstead'),
        onPress: () => {
          actions.archive(category.id);
          done?.();
        },
      };
      showDialog(title, body, category.archivedAt === null ? [cancel, archiveInstead, remove] : [cancel, remove]);
    },
    [t, language, numberingSystem],
  );
}
