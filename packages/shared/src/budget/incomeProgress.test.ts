import { incomeProgress } from './incomeProgress';

describe('incomeProgress', () => {
  it('is the share of the Expected Income received so far', () => {
    expect(incomeProgress({ income: 200000, expectedIncome: 800000 })).toBe(0.25);
  });

  it('is 0 before any Income arrives', () => {
    expect(incomeProgress({ income: 0, expectedIncome: 800000 })).toBe(0);
  });

  it('stops at 1 when Income goes above the Expected Income', () => {
    expect(incomeProgress({ income: 1000000, expectedIncome: 800000 })).toBe(1);
  });

  it('is null when the Month has no Expected Income, so there is no bar to show', () => {
    expect(incomeProgress({ income: 0, expectedIncome: 0 })).toBeNull();
    expect(incomeProgress({ income: 50000, expectedIncome: 0 })).toBeNull();
  });
});
