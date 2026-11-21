import { activeScheme, parseAppearance } from './appearance';

describe('parseAppearance', () => {
  it('reads a stored choice back', () => {
    expect(parseAppearance('dark')).toBe('dark');
    expect(parseAppearance('light')).toBe('light');
  });

  it('falls back to System when nothing (or something unknown) is stored', () => {
    expect(parseAppearance(null)).toBe('system');
    expect(parseAppearance('sepia')).toBe('system');
  });
});

describe('activeScheme', () => {
  it('follows the phone when the choice is System', () => {
    expect(activeScheme('system', 'dark')).toBe('dark');
    expect(activeScheme('system', 'light')).toBe('light');
  });

  it('uses Light when the phone gives no answer', () => {
    expect(activeScheme('system', null)).toBe('light');
  });

  it('keeps an explicit Light or Dark whatever the phone says', () => {
    expect(activeScheme('light', 'dark')).toBe('light');
    expect(activeScheme('dark', 'light')).toBe('dark');
  });
});
