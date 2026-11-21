import { DEFAULT_CATEGORY_KEYS, defaultCategoryId, type DefaultCategoryKey } from '@money-tracker/shared';
import type { IconName } from '@/ui';

const DEFAULT_ICONS: Record<DefaultCategoryKey, IconName> = {
  housing: 'home-outline',
  food: 'basket-outline',
  transport: 'car-outline',
  bills: 'flash-outline',
  health: 'medkit-outline',
  shopping: 'bag-handle-outline',
  entertainment: 'film-outline',
  kids: 'happy-outline',
};

/**
 * The icon for each Category of `accountId`: the default Categories have their
 * own (found by their fixed IDs), Other has "…", and Categories the adult
 * added get a tag.
 */
export function categoryIconFor(accountId: string | null) {
  const byId = new Map<string, IconName>(
    accountId ? DEFAULT_CATEGORY_KEYS.map((key) => [defaultCategoryId(accountId, key), DEFAULT_ICONS[key]]) : [],
  );
  return (category: { id: string; isOther: boolean }): IconName =>
    category.isOther ? 'ellipsis-horizontal' : (byId.get(category.id) ?? 'pricetag-outline');
}
