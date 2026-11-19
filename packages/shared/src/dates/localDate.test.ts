import { toLocalDate } from './localDate';

describe('toLocalDate', () => {
  it("is the device's calendar date, not the UTC one", () => {
    // 00:30 local time on 1 March: still 1 March whatever the time zone.
    expect(toLocalDate(new Date(2026, 2, 1, 0, 30))).toBe('2026-03-01');
    expect(toLocalDate(new Date(2026, 2, 31, 23, 59))).toBe('2026-03-31');
  });

  it('pads months and days', () => {
    expect(toLocalDate(new Date(987, 0, 5, 12))).toBe('0987-01-05');
  });
});
