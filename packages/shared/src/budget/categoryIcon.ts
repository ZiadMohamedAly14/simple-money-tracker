/**
 * Category icons. A Category record carries an `icon`: the name of one of the
 * app's own icons (`app:<name>` in the mobile app). The sync contract accepts
 * any short kebab-case name (`isCategoryIconName`), not only the ones below,
 * so a newer app's icon is never refused; an app shows `tag` for a name it
 * doesn't know.
 */

/** The icon for a Category with no better one. */
export const FALLBACK_CATEGORY_ICON = 'tag';

/** The icon the Other Category always shows, whatever its record says. */
export const OTHER_CATEGORY_ICON = 'other';

/** The icons an adult can pick for a Category, in picker order. */
export const CATEGORY_ICON_CHOICES = [
  'food-groceries',
  'bills-utilities',
  'monthly-bills',
  'shopping-spend',
  'housing',
  'transport',
  'health',
  'entertainment',
  'kids',
  'personal',
  'gift-give',
  'charity-hand-coin',
  'wallet',
  'jar-save',
  'tag',
] as const;

export type CategoryIconChoice = (typeof CATEGORY_ICON_CHOICES)[number];

/** Longest icon name a Category may carry. */
export const CATEGORY_ICON_MAX_LENGTH = 40;

/** A short kebab-case name such as `food-groceries`: what the sync contract accepts as a Category icon. */
export function isCategoryIconName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= CATEGORY_ICON_MAX_LENGTH &&
    /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)
  );
}

/**
 * Keywords, English and Arabic, for each icon the guess can give. English
 * keywords match whole words; Arabic ones also match with "ال" in front. A
 * keyword with a space matches that phrase.
 */
const KEYWORDS: readonly (readonly [CategoryIconChoice, readonly string[]])[] = [
  [
    'housing',
    ['rent', 'mortgage', 'house', 'home', 'apartment', 'flat', 'housing', 'إيجار', 'ايجار', 'سكن', 'بيت', 'منزل', 'شقة', 'عقار'],
  ],
  [
    'food-groceries',
    [
      'food', 'grocery', 'groceries', 'supermarket', 'market', 'restaurant', 'restaurants', 'lunch', 'dinner', 'breakfast',
      'coffee', 'cafe', 'snacks', 'bakery', 'eating out', 'takeaway',
      'أكل', 'اكل', 'طعام', 'بقالة', 'سوبرماركت', 'سوبر ماركت', 'مطعم', 'مطاعم', 'قهوة', 'غداء', 'عشاء', 'فطار', 'إفطار', 'مخبز', 'خضار',
    ],
  ],
  [
    'bills-utilities',
    [
      'bill', 'bills', 'utilities', 'utility', 'electricity', 'electric', 'water', 'gas', 'internet', 'wifi', 'phone', 'mobile',
      'فاتورة', 'فواتير', 'كهرباء', 'مياه', 'ماء', 'غاز', 'إنترنت', 'انترنت', 'نت', 'هاتف', 'تليفون', 'موبايل', 'جوال',
    ],
  ],
  ['monthly-bills', ['subscription', 'subscriptions', 'insurance', 'installment', 'installments', 'اشتراك', 'اشتراكات', 'تأمين', 'قسط', 'أقساط', 'اقساط']],
  [
    'transport',
    [
      'transport', 'transportation', 'uber', 'careem', 'taxi', 'cab', 'fuel', 'petrol', 'gasoline', 'car', 'bus', 'metro', 'train',
      'parking', 'commute',
      'مواصلات', 'نقل', 'أوبر', 'اوبر', 'كريم', 'تاكسي', 'بنزين', 'وقود', 'سيارة', 'عربية', 'أتوبيس', 'اتوبيس', 'باص', 'مترو', 'قطار', 'جراج',
    ],
  ],
  [
    'health',
    [
      'health', 'doctor', 'doctors', 'medicine', 'medicines', 'pharmacy', 'hospital', 'clinic', 'dentist', 'gym', 'fitness',
      'medical',
      'صحة', 'دكتور', 'طبيب', 'دواء', 'أدوية', 'ادوية', 'علاج', 'صيدلية', 'مستشفى', 'عيادة', 'أسنان', 'اسنان', 'جيم', 'رياضة', 'نادي',
    ],
  ],
  [
    'entertainment',
    [
      'entertainment', 'fun', 'netflix', 'spotify', 'movie', 'movies', 'cinema', 'games', 'gaming', 'music', 'concert', 'outing',
      'outings', 'travel', 'trip', 'vacation', 'holiday',
      'ترفيه', 'نتفليكس', 'سينما', 'فيلم', 'أفلام', 'افلام', 'ألعاب', 'العاب', 'موسيقى', 'خروجات', 'خروج', 'سفر', 'رحلة', 'رحلات', 'إجازة', 'اجازة',
    ],
  ],
  [
    'kids',
    [
      'kids', 'kid', 'children', 'child', 'baby', 'school', 'tuition', 'nursery', 'toys', 'diapers',
      'أطفال', 'اطفال', 'أولاد', 'اولاد', 'عيال', 'طفل', 'مدرسة', 'مدارس', 'حضانة', 'مصاريف مدرسية', 'حفاضات', 'بامبرز',
    ],
  ],
  [
    'shopping-spend',
    ['shopping', 'clothes', 'clothing', 'shoes', 'amazon', 'mall', 'electronics', 'تسوق', 'مشتريات', 'ملابس', 'لبس', 'هدوم', 'أحذية', 'احذية', 'أمازون', 'امازون', 'مول'],
  ],
  ['personal', ['personal', 'haircut', 'salon', 'barber', 'beauty', 'cosmetics', 'شخصي', 'شخصية', 'حلاق', 'حلاقة', 'صالون', 'تجميل', 'مكياج']],
  ['gift-give', ['gift', 'gifts', 'present', 'presents', 'birthday', 'wedding', 'هدية', 'هدايا', 'عيد ميلاد', 'فرح', 'عيدية']],
  ['charity-hand-coin', ['charity', 'donation', 'donations', 'zakat', 'sadaqa', 'sadaqah', 'tithe', 'صدقة', 'صدقات', 'زكاة', 'تبرع', 'تبرعات', 'خير']],
  ['jar-save', ['saving', 'savings', 'save', 'emergency', 'investment', 'investments', 'ادخار', 'إدخار', 'توفير', 'طوارئ', 'استثمار', 'إستثمار']],
  ['wallet', ['cash', 'pocket money', 'allowance', 'wallet', 'كاش', 'نقدية', 'مصروف', 'محفظة']],
];

/** Lowercases and evens out Arabic spelling (alef forms, taa marbuta, alef maqsura, tatweel, diacritics). */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

/** Words of a name, with an Arabic "ال" (also "وال", "بال", "لل") taken off the front. */
function wordsOf(text: string): string[] {
  return normalize(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0)
    .map((word) => word.replace(/^(?:و|ب|ف)?ال(?=.{2,})|^لل(?=.{2,})/, ''));
}

const MATCHERS = KEYWORDS.map(([icon, keywords]) => ({ icon, phrases: keywords.map(wordsOf) }));

/**
 * The icon a new Category starts with, guessed from its name as it's typed:
 * the first icon one of whose keywords is in the name, else `tag`.
 */
export function guessCategoryIcon(name: string): string {
  const words = wordsOf(name);
  for (const { icon, phrases } of MATCHERS) {
    for (const phrase of phrases) {
      if (phrase.length === 0) continue;
      for (let start = 0; start + phrase.length <= words.length; start += 1) {
        if (phrase.every((word, i) => words[start + i] === word)) return icon;
      }
    }
  }
  return FALLBACK_CATEGORY_ICON;
}
