import { secondsUntil } from './secondsUntil';

describe('secondsUntil', () => {
  it('rounds a wait up to whole seconds', () => {
    expect(secondsUntil(new Date(1_000), new Date(3_001))).toBe(3);
    expect(secondsUntil(1_000, 61_000)).toBe(60);
  });

  it('is never less than 1, so a "try again in" countdown never shows 0', () => {
    expect(secondsUntil(5_000, 5_000)).toBe(1);
    expect(secondsUntil(9_000, 5_000)).toBe(1);
  });
});
