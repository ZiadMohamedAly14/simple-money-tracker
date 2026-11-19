import { formatCountdown } from './countdown';

describe('formatCountdown ("Resend code in 0:30")', () => {
  it.each([
    [30, '0:30'],
    [5, '0:05'],
    [60, '1:00'],
    [605, '10:05'],
    [0, '0:00'],
  ])('shows %d seconds as %s', (seconds, expected) => {
    expect(formatCountdown(seconds, { language: 'en' })).toBe(expected);
  });

  it('never shows a negative time', () => {
    expect(formatCountdown(-3, { language: 'en' })).toBe('0:00');
  });

  it('uses Western digits in Arabic by default, and Arabic-Indic digits when chosen', () => {
    expect(formatCountdown(30, { language: 'ar' })).toBe('0:30');
    expect(formatCountdown(30, { language: 'ar', numberingSystem: 'arabic-indic' })).toBe('٠:٣٠');
  });
});
