import { formatDigits, toWesternDigits } from './digits';

describe('formatDigits', () => {
  it('writes a whole number in the chosen digits, never grouped', () => {
    expect(formatDigits(25, { language: 'en' })).toBe('25');
    expect(formatDigits(25, { language: 'ar', numberingSystem: 'arabic-indic' })).toBe('٢٥');
    expect(formatDigits(2026, { language: 'ar', numberingSystem: 'arabic-indic' })).toBe('٢٠٢٦');
  });

  it('keeps Western digits in English whatever the setting', () => {
    expect(formatDigits(7, { language: 'en', numberingSystem: 'arabic-indic' })).toBe('7');
  });
});

describe('toWesternDigits', () => {
  it('turns Arabic-Indic digits into Western ones', () => {
    expect(toWesternDigits('١٢٣')).toBe('123');
  });
});
