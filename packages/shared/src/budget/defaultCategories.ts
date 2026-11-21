/**
 * The Categories a new Account starts with, personal or kid path (spec, story
 * 13), in display order. Other is not listed: every Account has it already
 * (see `OTHER_CATEGORY`), and it sorts last. Each key is the translation key
 * of the Category's name and, with `defaultCategoryId`, fixes its ID, so two
 * devices onboarding offline make the same records. Never rename a key.
 *
 * Accounts made before ticket 21 also have `housing`, `transport`, `health`,
 * `entertainment` and `kids` (see `EARLIER_DEFAULT_CATEGORY_ICONS`).
 */
export const DEFAULT_CATEGORY_KEYS = ['food', 'bills', 'shopping'] as const;

export type DefaultCategoryKey = (typeof DEFAULT_CATEGORY_KEYS)[number];

/** The icon each default Category starts with. */
export const DEFAULT_CATEGORY_ICONS: Record<DefaultCategoryKey, string> = {
  food: 'food-groceries',
  bills: 'bills-utilities',
  shopping: 'shopping-spend',
};

/**
 * Every key a default Category has ever had, with the icon it showed. Records
 * made before icons synced have no icon; the app finds theirs by ID here.
 */
export const EARLIER_DEFAULT_CATEGORY_ICONS = {
  housing: 'housing',
  food: 'food-groceries',
  transport: 'transport',
  bills: 'bills-utilities',
  health: 'health',
  shopping: 'shopping-spend',
  entertainment: 'entertainment',
  kids: 'kids',
} as const;
