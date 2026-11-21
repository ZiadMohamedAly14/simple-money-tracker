import { currentMonth, monthOf } from './month';

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
