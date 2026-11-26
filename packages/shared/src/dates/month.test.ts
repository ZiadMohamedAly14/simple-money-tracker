import { addMonths, currentMonth, formatMonth, monthDates, monthOf, type PayDayHistory } from './month';

/** A history whose one Pay Day has been in force since long before the dates under test. */
const since = (payDay: number): PayDayHistory => [{ payDay, startsOn: `2020-01-${String(payDay).padStart(2, '0')}` }];

const nextDay = (date: string): string => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

/**
 * Walks `days` days from `from`: each day is in the same Month as the day
 * before or the next one by name, and every Month's dates are exactly the days
 * that fall in it.
 */
function expectConsecutiveMonths(history: PayDayHistory, from: string, days: number): void {
  let date = from;
  let month = monthOf(date, history);
  expect(monthDates(month, history).start <= date).toBe(true);
  for (let i = 0; i < days; i++) {
    const next = nextDay(date);
    const nextMonth = monthOf(next, history);
    if (nextMonth === month) {
      expect(monthDates(month, history).end > date).toBe(true);
    } else {
      expect([date, nextMonth]).toEqual([monthDates(month, history).end, addMonths(month, 1)]);
      expect(monthDates(nextMonth, history).start).toBe(next);
    }
    date = next;
    month = nextMonth;
  }
}

describe('monthOf with a Pay Day', () => {
  it('names a Month after the calendar month it starts in for Pay Day 1–15', () => {
    expect(monthOf('2026-11-23', since(5))).toBe('2026-11');
    expect(monthOf('2026-11-10', since(15))).toBe('2026-10');
  });
});

describe('Month boundaries and names (spec worked examples)', () => {
  it.each([
    // Pay Day, date, Month name, first day, last day
    [1, '2026-11-23', '2026-11', '2026-11-01', '2026-11-30'],
    [5, '2026-11-23', '2026-11', '2026-11-05', '2026-12-04'],
    [15, '2026-11-10', '2026-10', '2026-10-15', '2026-11-14'],
    [16, '2026-11-23', '2026-12', '2026-11-16', '2026-12-15'],
    [26, '2026-11-23', '2026-11', '2026-10-26', '2026-11-25'],
    [26, '2026-11-26', '2026-12', '2026-11-26', '2026-12-25'],
    [28, '2026-11-23', '2026-11', '2026-10-28', '2026-11-27'],
    [31, '2027-03-15', '2027-03', '2027-02-28', '2027-03-30'],
    // The spec table names this "May", but that contradicts its own row above
    // (28 Feb – 30 Mar is March) and would skip April; decision 4 makes it April.
    [31, '2027-04-20', '2027-04', '2027-03-31', '2027-04-29'],
    [16, '2027-02-20', '2027-03', '2027-02-16', '2027-03-15'],
    [16, '2027-02-15', '2027-02', '2027-01-16', '2027-02-15'],
  ])('Pay Day %i: %s is in %s, %s – %s', (payDay, date, month, start, end) => {
    expect(monthOf(date, since(payDay))).toBe(month);
    expect(monthDates(month, since(payDay))).toEqual({ start, end });
  });

  it('Pay Day 31 is the last day of each month', () => {
    const starts = ['2027-02', '2027-03', '2027-04', '2027-05'].map((month) => monthDates(month, since(31)).start);
    expect(starts).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
  });

  it.each(Array.from({ length: 31 }, (_, i) => i + 1))('Pay Day %i never repeats or skips a Month name over 24 months', (payDay) => {
    expectConsecutiveMonths(since(payDay), '2026-01-01', 24 * 31);
  });

  it('an empty history is calendar months', () => {
    expect(monthDates('2024-02', [])).toEqual({ start: '2024-02-01', end: '2024-02-29' });
    expect(monthDates('2026-12', [])).toEqual({ start: '2026-12-01', end: '2026-12-31' });
  });
});

describe('addMonths', () => {
  it('steps to the previous and next Month, across year ends', () => {
    expect(addMonths('2026-03', -1)).toBe('2026-02');
    expect(addMonths('2026-03', 1)).toBe('2026-04');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-11', -23)).toBe('2024-12');
    expect(addMonths('2026-11', 0)).toBe('2026-11');
  });
});

describe('formatMonth', () => {
  it('names the Month and year in the language', () => {
    expect(formatMonth('2026-11', { language: 'en' })).toBe('November 2026');
    expect(formatMonth('2026-01', { language: 'en' })).toBe('January 2026');
  });

  it('uses Arabic month names, with Western digits unless Arabic-Indic are chosen', () => {
    expect(formatMonth('2026-11', { language: 'ar' })).toBe('نوفمبر 2026');
    expect(formatMonth('2026-11', { language: 'ar', numberingSystem: 'arabic-indic' })).toBe('نوفمبر ٢٠٢٦');
  });

  it('is not moved into a neighbouring Month by the time zone', () => {
    // The suite runs at UTC+14; midnight UTC on the 1st is still the same Month.
    expect(formatMonth('2026-12', { language: 'en' })).toBe('December 2026');
  });
});

// jest.config.js runs this suite at UTC+14 (Pacific/Kiritimati).

describe('monthOf', () => {
  it('is the calendar month of a local date', () => {
    expect(monthOf('2026-03-01')).toBe('2026-03');
    expect(monthOf('2026-03-31')).toBe('2026-03');
    expect(monthOf('2024-02-29')).toBe('2024-02');
    expect(monthOf('2026-12-31')).toBe('2026-12');
  });
});

describe('currentMonth', () => {
  it('a moment just after local midnight on the 1st is in the new Month, though UTC is still in the old one', () => {
    // 00:05 on 1 April local is 10:05 on 31 March UTC.
    const moment = new Date(2026, 3, 1, 0, 5);
    expect(moment.getUTCMonth()).toBe(2); // March in UTC
    expect(currentMonth(moment)).toBe('2026-04');
  });

  it('a moment just before local midnight on the last day is still in that Month', () => {
    expect(currentMonth(new Date(2026, 0, 31, 23, 59, 59))).toBe('2026-01');
    expect(currentMonth(new Date(2026, 1, 1, 0, 0, 0))).toBe('2026-02');
  });

  it('handles the year end and leap days', () => {
    // 00:30 on 1 January local is still 31 December in UTC.
    expect(currentMonth(new Date(2027, 0, 1, 0, 30))).toBe('2027-01');
    expect(currentMonth(new Date(2026, 11, 31, 23, 59, 59))).toBe('2026-12');
    expect(currentMonth(new Date(2028, 1, 29, 12))).toBe('2028-02');
    expect(currentMonth(new Date(2028, 2, 1, 0, 1))).toBe('2028-03');
  });
});
