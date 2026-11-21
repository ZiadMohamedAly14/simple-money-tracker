/**
 * The Categories a new personal Account starts with (spec, story 13), in
 * display order. Other is not listed: every Account has it already (see
 * `OTHER_CATEGORY`), and it sorts last. Each key is the translation key of
 * the Category's name and, with `defaultCategoryId`, fixes its ID, so two
 * devices onboarding offline make the same records. Never rename a key.
 */
export const DEFAULT_CATEGORY_KEYS = [
  'housing',
  'food',
  'transport',
  'bills',
  'health',
  'shopping',
  'entertainment',
  'kids',
] as const;

export type DefaultCategoryKey = (typeof DEFAULT_CATEGORY_KEYS)[number];
