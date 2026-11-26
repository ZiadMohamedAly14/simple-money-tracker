import { createInstance, type TFunction } from 'i18next';
import { payDayOptions, type PayDayHistory } from '@money-tracker/shared';
import { ar } from './locales/ar';
import { en } from './locales/en';
import { changeoverPreview } from './payDayPreview';

async function translator(language: 'en' | 'ar'): Promise<TFunction> {
  const i18n = createInstance();
  await i18n.init({ resources: { en: { translation: en }, ar: { translation: ar } }, lng: language, interpolation: { escapeValue: false } });
  return i18n.t;
}

async function englishPreview(history: PayDayHistory, payDay: number, today: string) {
  return changeoverPreview(history, payDay, today, { t: await translator('en'), language: 'en' });
}

/** Pay Day 25, set early in October 2026 so it is in force in November and December. */
const payDay25 = payDayOptions([], 25, '2026-10-01').startNow!.history;

// The spec's "Changing Pay Day" table, row by row.
describe('changeoverPreview: the worked examples', () => {
  it('1 → 25 on 10 Nov', async () => {
    expect(await englishPreview([], 25, '2026-11-10')).toEqual({
      startNow: [
        { title: 'November', dates: 'Nov 1 – Nov 24' },
        { title: 'December', dates: 'from Nov 25' },
      ],
      startAfterThisMonth: [
        { title: 'November', dates: 'Nov 1 – Nov 30' },
        { title: 'December (Bridge Month)', dates: 'Dec 1 – Dec 24' },
        { title: 'January', dates: 'from Dec 25' },
      ],
    });
  });

  it('1 → 26 on 23 Nov', async () => {
    expect(await englishPreview([], 26, '2026-11-23')).toEqual({
      startNow: [
        { title: 'November', dates: 'Nov 1 – Nov 25' },
        { title: 'December', dates: 'from Nov 26' },
      ],
      startAfterThisMonth: [
        { title: 'November', dates: 'Nov 1 – Nov 30' },
        { title: 'December (Bridge Month)', dates: 'Dec 1 – Dec 25' },
        { title: 'January', dates: 'from Dec 26' },
      ],
    });
  });

  it('1 → 20 on 25 Nov: Start now is not offered, as it would skip December', async () => {
    expect(await englishPreview([], 20, '2026-11-25')).toEqual({
      startNow: null,
      startAfterThisMonth: [
        { title: 'November', dates: 'Nov 1 – Nov 30' },
        { title: 'December (Bridge Month)', dates: 'Dec 1 – Dec 19' },
        { title: 'January', dates: 'from Dec 20' },
      ],
    });
  });

  it('25 → 10 on 30 Nov', async () => {
    expect(await englishPreview(payDay25, 10, '2026-11-30')).toEqual({
      startNow: [
        { title: 'December', dates: 'Nov 25 – Jan 9' },
        { title: 'January', dates: 'from Jan 10' },
      ],
      startAfterThisMonth: [
        { title: 'December', dates: 'Nov 25 – Dec 24' },
        { title: 'January (Bridge Month)', dates: 'Dec 25 – Feb 9' },
        { title: 'February', dates: 'from Feb 10' },
      ],
    });
  });
});

describe('changeoverPreview in Arabic', () => {
  it('names the Months in Arabic, marks the Bridge Month, and uses the chosen digits', async () => {
    const preview = changeoverPreview([], 25, '2026-11-10', { t: await translator('ar'), language: 'ar', numberingSystem: 'arabic-indic' });
    expect(preview.startAfterThisMonth).toEqual([
      { title: 'نوفمبر', dates: '١ نوفمبر – ٣٠ نوفمبر' },
      { title: 'ديسمبر (شهر انتقالي)', dates: '١ ديسمبر – ٢٤ ديسمبر' },
      { title: 'يناير', dates: 'من ٢٥ ديسمبر' },
    ]);
  });
});
