import { expectedIncomeGap } from './expectedIncomeGap';

describe('expectedIncomeGap', () => {
  it('is the Expected Income still to be recorded as Income', () => {
    expect(expectedIncomeGap({ expectedIncome: 800000, income: 0 })).toBe(800000);
    expect(expectedIncomeGap({ expectedIncome: 800000, income: 50000 })).toBe(750000);
  });

  it('is null once Income reaches Expected Income, or when there is no Expected Income', () => {
    expect(expectedIncomeGap({ expectedIncome: 800000, income: 800000 })).toBeNull();
    expect(expectedIncomeGap({ expectedIncome: 800000, income: 820000 })).toBeNull();
    expect(expectedIncomeGap({ expectedIncome: 0, income: 0 })).toBeNull();
  });
});
