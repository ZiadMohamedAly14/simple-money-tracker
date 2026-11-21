import { EARLIER_DEFAULT_CATEGORY_ICONS, FALLBACK_CATEGORY_ICON, OTHER_CATEGORY_ICON, defaultCategoryId } from '@money-tracker/shared';
import { APP_ICONS, type AppIconName } from '@/ui/appIcons';
import type { GlyphName } from '@/ui';

const isAppIcon = (name: string): name is AppIconName => Object.prototype.hasOwnProperty.call(APP_ICONS, name);

/** The glyph for a Category icon name: `app:<name>` if this app has it, otherwise `app:tag`. */
export function categoryGlyph(icon: string | null | undefined): GlyphName {
  return `app:${icon && isAppIcon(icon) ? icon : FALLBACK_CATEGORY_ICON}` as GlyphName;
}

/**
 * The icon for each Category of `accountId`. Other always shows `app:other`.
 * Any other Category shows its synced icon (`app:tag` if this app doesn't
 * have it). A record from before icons synced has none: a default Category is
 * found by its fixed ID, and anything else shows `app:tag`.
 */
export function categoryIconFor(accountId: string | null) {
  const byId = new Map<string, string>(
    accountId
      ? Object.entries(EARLIER_DEFAULT_CATEGORY_ICONS).map(([key, icon]) => [defaultCategoryId(accountId, key), icon])
      : [],
  );
  return (category: { id: string; isOther: boolean; icon?: string | null }): GlyphName =>
    category.isOther ? categoryGlyph(OTHER_CATEGORY_ICON) : categoryGlyph(category.icon ?? byId.get(category.id));
}
