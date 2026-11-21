import { kidModeAllows } from './kidModeRoutes';

describe('kidModeAllows', () => {
  it("opens the kid's screens and Learn, and nothing Personal", () => {
    for (const segments of [[], ['index'], ['kid', '[id]'], ['kid', '[id]', 'spend'], ['learn']]) {
      expect(kidModeAllows(segments, false)).toBe(true);
    }
    for (const segments of [['transactions'], ['categories'], ['settings'], ['onboarding'], ['pin', 'set'], ['pin', 'reset']]) {
      expect(kidModeAllows(segments, true)).toBe(false);
    }
  });

  it('opens the Parent Area gate, and the rest of the Parent Area only once elevated with the PIN', () => {
    expect(kidModeAllows(['parent'], false)).toBe(true);
    expect(kidModeAllows(['parent', 'kids', '[id]', 'top-up'], false)).toBe(false);
    expect(kidModeAllows(['parent', 'devices'], false)).toBe(false);

    expect(kidModeAllows(['parent', 'kids', '[id]', 'top-up'], true)).toBe(true);
    expect(kidModeAllows(['parent', 'kids', '[id]'], true)).toBe(true);
    expect(kidModeAllows(['parent', 'devices'], true)).toBe(true);
  });

  it('keeps the parts of the Parent Area that belong on the parent’s own phone closed', () => {
    expect(kidModeAllows(['parent', 'kids', 'new'], true)).toBe(false);
    expect(kidModeAllows(['parent', 'kid-device'], true)).toBe(false);
    expect(kidModeAllows(['parent', 'kid-device', 'pin'], true)).toBe(false);
    // Setting up a phone for a kid and "Whose phone is this?" live outside /parent.
    expect(kidModeAllows(['kid-device'], true)).toBe(false);
    expect(kidModeAllows(['kid-device', 'new'], true)).toBe(false);
    expect(kidModeAllows(['whose-phone'], true)).toBe(false);
  });
});
