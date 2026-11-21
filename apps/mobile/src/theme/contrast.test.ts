import { contrastRatio } from './contrast';
import { themes, type ColorToken, type ThemeName } from './themes';
import type { ColorScheme } from './appearance';
import { ICON_CIRCLE_TONES } from '@/ui/iconCircleTones';

describe('contrastRatio', () => {
  it('matches known WCAG ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    // #767676 is the classic lightest grey that passes AA on white.
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
  });

  it('does not depend on the order of the colours', () => {
    expect(contrastRatio('#1F7A63', '#FFFFFF')).toBeCloseTo(contrastRatio('#FFFFFF', '#1F7A63'), 10);
  });
});

/** WCAG AA for body text. */
const AA = 4.5;

/** [foreground, background] pairs that carry text. */
const TEXT_PAIRS: [ColorToken, ColorToken][] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['text', 'tint'],
  ['text', 'chip'],
  ['muted', 'background'],
  ['muted', 'surface'],
  ['on-primary', 'primary'],
  ['primary', 'surface'],
  ['on-dark', 'dark'],
  ['on-warning', 'warning'],
  ['negative', 'surface'],
  ['negative', 'negative-surface'],
  ['on-accent', 'accent'],
];

const VARIANTS: [ThemeName, ColorScheme][] = [
  ['personal', 'light'],
  ['personal', 'dark'],
  ['kid', 'light'],
  ['kid', 'dark'],
];

describe('palette contrast', () => {
  it.each(VARIANTS)('%s %s text meets WCAG AA', (name, scheme) => {
    const colors = themes[name][scheme].colors;
    const failing = TEXT_PAIRS.map(([fg, bg]) => ({ pair: `${fg} on ${bg}`, ratio: contrastRatio(colors[fg], colors[bg]) }))
      .filter(({ ratio }) => ratio < AA)
      .map(({ pair, ratio }) => `${pair}: ${ratio.toFixed(2)}`);
    expect(failing).toEqual([]);
  });

  it.each(VARIANTS)('%s %s dark button stands out on the screen background', (name, scheme) => {
    const colors = themes[name][scheme].colors;
    // Non-text UI needs 3:1 (WCAG 1.4.11).
    expect(contrastRatio(colors.dark, colors.background)).toBeGreaterThanOrEqual(3);
  });

  it.each(VARIANTS)('%s %s icons stand out on every icon-circle fill', (name, scheme) => {
    const colors = themes[name][scheme].colors;
    // Icons are non-text UI: 3:1 (WCAG 1.4.11).
    const failing = Object.entries(ICON_CIRCLE_TONES)
      .map(([tone, { fill, icon }]) => ({ tone, ratio: contrastRatio(colors[icon], colors[fill]) }))
      .filter(({ ratio }) => ratio < 3)
      .map(({ tone, ratio }) => `${tone}: ${ratio.toFixed(2)}`);
    expect(failing).toEqual([]);
  });
});
