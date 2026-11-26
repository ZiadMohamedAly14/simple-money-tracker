import { createInstance, type TFunction } from 'i18next';
import { ar } from './locales/ar';
import { en } from './locales/en';
import { payDayLabel } from './payDayLabel';

async function translator(language: 'en' | 'ar'): Promise<TFunction> {
  const i18n = createInstance();
  await i18n.init({ resources: { en: { translation: en }, ar: { translation: ar } }, lng: language, interpolation: { escapeValue: false } });
  return i18n.t;
}

describe('payDayLabel', () => {
  it('reads as an English ordinal', async () => {
    const t = await translator('en');
    const label = (day: number) => payDayLabel(day, { t, language: 'en' });
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 25, 30].map(label)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '25th', '30th',
    ]);
  });

  it('labels 31 "Last day of the month", in both languages', async () => {
    expect(payDayLabel(31, { t: await translator('en'), language: 'en' })).toBe('Last day of the month');
    expect(payDayLabel(31, { t: await translator('ar'), language: 'ar' })).toBe('آخر يوم في الشهر');
  });

  it('in Arabic, reads "day N" in the chosen digits', async () => {
    const t = await translator('ar');
    expect(payDayLabel(25, { t, language: 'ar' })).toBe('يوم 25');
    expect(payDayLabel(25, { t, language: 'ar', numberingSystem: 'arabic-indic' })).toBe('يوم ٢٥');
  });
});
