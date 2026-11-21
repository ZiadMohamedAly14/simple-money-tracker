import { formatAmountExpression, formatAmountInput, formatMoneyParts } from './display';

/** Drop the invisible bidi marks Intl adds in Arabic, and normalize no-break spaces. */
const visible = (text: string) => text.replace(/[‎‏؜]/g, '').replace(/[  ]/g, ' ');

describe('formatMoneyParts (big amount with a smaller currency label beside it)', () => {
  it('splits an English amount from its currency code', () => {
    expect(formatMoneyParts(125000, { language: 'en', currency: 'EGP' })).toEqual({ amount: '1,250.00', currency: 'EGP' });
  });

  it('uses the Arabic currency symbol in Arabic', () => {
    const parts = formatMoneyParts(125000, { language: 'ar', currency: 'EGP' });
    expect(visible(parts.amount)).toBe('1,250.00');
    expect(visible(parts.currency)).toBe('ج.م.');
  });

  it('uses Arabic-Indic digits when chosen', () => {
    const parts = formatMoneyParts(125000, { language: 'ar', currency: 'EGP', numberingSystem: 'arabic-indic' });
    expect(visible(parts.amount)).toBe('١٬٢٥٠٫٠٠');
  });

  it('keeps the sign with the amount, such as negative Unallocated', () => {
    expect(formatMoneyParts(-150000, { language: 'en', currency: 'EGP' }).amount).toBe('-1,500.00');
    expect(visible(formatMoneyParts(-50, { language: 'ar', currency: 'EGP' }).amount)).toBe('-0.50');
  });

  it('uses the currency’s own minor digits', () => {
    expect(formatMoneyParts(500, { language: 'en', currency: 'JPY' })).toEqual({ amount: '500', currency: '¥' });
  });
});

describe('formatAmountInput (an amount as it is being typed on the keypad)', () => {
  it('shows 0 for nothing typed', () => {
    expect(formatAmountInput('', { language: 'en' })).toBe('0');
  });

  it('groups the whole part', () => {
    expect(formatAmountInput('1250', { language: 'en' })).toBe('1,250');
  });

  it('keeps a trailing decimal point and fraction zeros exactly as typed', () => {
    expect(formatAmountInput('1250.', { language: 'en' })).toBe('1,250.');
    expect(formatAmountInput('0.50', { language: 'en' })).toBe('0.50');
  });

  it('uses the chosen numbering system', () => {
    expect(visible(formatAmountInput('1250.5', { language: 'ar', numberingSystem: 'arabic-indic' }))).toBe('١٬٢٥٠٫٥');
  });

  it('uses Western digits in Arabic by default', () => {
    expect(visible(formatAmountInput('1250.5', { language: 'ar' }))).toBe('1,250.5');
  });
});

describe('formatAmountExpression (a keypad sum as it is being typed)', () => {
  const LRI = '⁦';
  const PDI = '⁩';

  it('shows the operators as + − × ÷ between grouped numbers, inside a left-to-right isolate', () => {
    expect(formatAmountExpression('1200+35*2-9/3', { language: 'en' })).toBe(`${LRI}1,200 + 35 × 2 − 9 ÷ 3${PDI}`);
  });

  it('keeps a trailing operator and a trailing decimal point as typed', () => {
    expect(formatAmountExpression('120+', { language: 'en' })).toBe(`${LRI}120 +${PDI}`);
    expect(formatAmountExpression('5+12.', { language: 'en' })).toBe(`${LRI}5 + 12.${PDI}`);
  });

  it('shows 0 for nothing typed', () => {
    expect(formatAmountExpression('', { language: 'en' })).toBe(`${LRI}0${PDI}`);
  });

  it('stays left to right in Arabic, with digits in the chosen numbering system', () => {
    expect(visible(formatAmountExpression('1200+35.5', { language: 'ar', numberingSystem: 'arabic-indic' }))).toBe(
      `${LRI}١٬٢٠٠ + ٣٥٫٥${PDI}`,
    );
    expect(visible(formatAmountExpression('300/3', { language: 'ar' }))).toBe(`${LRI}300 ÷ 3${PDI}`);
  });
});
