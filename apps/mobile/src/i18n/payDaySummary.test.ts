import { createInstance, type TFunction } from 'i18next';
import { payDayOptions } from '@money-tracker/shared';
import { ar } from './locales/ar';
import { en } from './locales/en';
import { payDaySummary } from './payDayPreview';

async function translator(language: 'en' | 'ar'): Promise<TFunction> {
  const i18n = createInstance();
  await i18n.init({ resources: { en: { translation: en }, ar: { translation: ar } }, lng: language, interpolation: { escapeValue: false } });
  return i18n.t;
}

describe('payDaySummary (the Settings row)', () => {
  it('shows the Pay Day in force: 1st for an Account that never changed it', async () => {
    expect(payDaySummary([], '2026-11-10', { t: await translator('en'), language: 'en' })).toBe('1st');
  });

  it('while a Start after this Month change is pending, shows "1st → 25th from" the Bridge Month\'s first day', async () => {
    const t = await translator('en');
    const history = payDayOptions([], 25, '2026-11-10').startAfterThisMonth.history;
    expect(payDaySummary(history, '2026-11-10', { t, language: 'en' })).toBe('1st → 25th from Dec 1');
    expect(payDaySummary(history, '2026-11-30', { t, language: 'en' })).toBe('1st → 25th from Dec 1');
  });

  it('once the Bridge Month has started, shows when the first Month on the new Pay Day starts', async () => {
    const t = await translator('en');
    const history = payDayOptions([], 25, '2026-11-10').startAfterThisMonth.history;
    expect(payDaySummary(history, '2026-12-01', { t, language: 'en' })).toBe('1st → 25th from Dec 25');
  });

  it('after a Start now change, shows when the first Month on the new Pay Day starts', async () => {
    const t = await translator('en');
    const history = payDayOptions([], 25, '2026-11-10').startNow!.history;
    expect(payDaySummary(history, '2026-11-10', { t, language: 'en' })).toBe('1st → 25th from Nov 25');
  });

  it('shows just the new Pay Day once the change has taken effect', async () => {
    const t = await translator('en');
    const history = payDayOptions([], 25, '2026-11-10').startAfterThisMonth.history;
    expect(payDaySummary(history, '2026-12-25', { t, language: 'en' })).toBe('25th');
  });

  it('labels 31 as the last day of the month', async () => {
    const t = await translator('en');
    const history = payDayOptions([], 31, '2026-11-10').startAfterThisMonth.history;
    expect(payDaySummary(history, '2026-11-10', { t, language: 'en' })).toBe('1st → Last day of the month from Dec 1');
  });

  it('in Arabic, points the arrow the reading way', async () => {
    const t = await translator('ar');
    const history = payDayOptions([], 25, '2026-11-10').startAfterThisMonth.history;
    expect(payDaySummary(history, '2026-11-10', { t, language: 'ar', numberingSystem: 'arabic-indic' })).toBe('يوم ١ ← يوم ٢٥ من ١ ديسمبر');
  });
});
