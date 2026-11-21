import { DEFAULT_CATEGORY_KEYS, defaultCategoryId, type DefaultCategoryKey } from '@money-tracker/shared';
import type { GlyphName } from '@/ui';

const DEFAULT_ICONS: Record<DefaultCategoryKey, GlyphName> = {
  housing: 'app:housing',
  food: 'app:food-groceries',
  transport: 'app:transport',
  bills: 'app:bills-utilities',
  health: 'app:health',
  shopping: 'app:shopping-spend',
  entertainment: 'app:entertainment',
  kids: 'app:kids',
};

/**
 * The icon for each Category of `accountId`: the default Categories have their
 * own custom icon (found by their fixed IDs), Other has `app:other`, and
 * Categories the adult added get a tag (the custom set has no generic one).
 */
export function categoryIconFor(accountId: string | null) {
  const byId = new Map<string, GlyphName>(
    accountId ? DEFAULT_CATEGORY_KEYS.map((key) => [defaultCategoryId(accountId, key), DEFAULT_ICONS[key]]) : [],
  );
  return (category: { id: string; isOther: boolean }): GlyphName =>
    category.isOther ? 'app:other' : (byId.get(category.id) ?? 'pricetag-outline');
}
