import { addMonths, monthDates, payDayOptions } from '@money-tracker/shared';
import { defaultDateIn, reviewableMonths } from './months';

describe('defaultDateIn', () => {
  it('is today in the current Month, or when no Month is given', () => {
    expect(defaultDateIn('2026-11', [], '2026-11-26')).toBe('2026-11-26');
    expect(defaultDateIn(undefined, [], '2026-11-26')).toBe('2026-11-26');
  });

  it("is an earlier Month's last day, so a Transaction added while reviewing it lands in it", () => {
    expect(defaultDateIn('2026-02', [], '2026-11-26')).toBe('2026-02-28');
  });

  it("with Pay Day 26, is the earlier Month's last day under Pay Day, not its calendar month's", () => {
    const history = payDayOptions([], 26, '2026-10-05').startNow!.history;
    // 26 Nov is already in December, so "November" (26 Oct – 25 Nov) is an earlier Month.
    expect(defaultDateIn('2026-11', history, '2026-11-26')).toBe('2026-11-25');
    expect(defaultDateIn('2026-12', history, '2026-11-26')).toBe('2026-11-26');
  });
});

describe('reviewableMonths', () => {
  it('with Pay Day 1, goes from the earliest plan or Transaction to the current calendar month', () => {
    expect(
      reviewableMonths({ today: '2026-11-26', history: [], firstPlanMonth: '2026-09', earliestTransactionDate: '2026-10-31' }),
    ).toEqual({ first: '2026-09', current: '2026-11' });
  });

  it('with Pay Day 26, a date after the Pay Day is already in the next Month', () => {
    const history = payDayOptions([], 26, '2026-10-05').startNow!.history;
    expect(
      reviewableMonths({ today: '2026-11-26', history, firstPlanMonth: '2026-12', earliestTransactionDate: '2026-11-26' }),
    ).toEqual({ first: '2026-12', current: '2026-12' });
  });

  it('steps through the Months of a changeover with no gaps', () => {
    // Spec: 1 → 25 on 10 Nov, start after this Month: December is a Bridge Month, 1 – 24 Dec.
    const history = payDayOptions([], 25, '2026-11-10').startAfterThisMonth.history;
    const { first, current } = reviewableMonths({
      today: '2027-01-30',
      history,
      firstPlanMonth: '2026-11',
      earliestTransactionDate: '2026-10-15',
    });
    expect({ first, current }).toEqual({ first: '2026-10', current: '2027-02' });

    const shown = [first];
    while (shown.at(-1)! < current) shown.push(addMonths(shown.at(-1)!, 1));
    expect(shown.map((month) => monthDates(month, history))).toEqual([
      { start: '2026-10-01', end: '2026-10-31' },
      { start: '2026-11-01', end: '2026-11-30' },
      { start: '2026-12-01', end: '2026-12-24' },
      { start: '2026-12-25', end: '2027-01-24' },
      { start: '2027-01-25', end: '2027-02-24' },
    ]);
  });
});
