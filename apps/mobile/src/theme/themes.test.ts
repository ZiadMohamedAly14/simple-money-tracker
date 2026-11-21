import { COLOR_TOKENS, themes, themeVariables, type ThemeName } from './themes';
import type { ColorScheme } from './appearance';

const VARIANTS: [ThemeName, ColorScheme][] = [
  ['personal', 'light'],
  ['personal', 'dark'],
  ['kid', 'light'],
  ['kid', 'dark'],
];

describe('themes', () => {
  it.each(VARIANTS)('%s %s defines every token as a hex colour', (name, scheme) => {
    const colors = themes[name][scheme].colors;
    expect(Object.keys(colors).sort()).toEqual([...COLOR_TOKENS].sort());
    for (const token of COLOR_TOKENS) expect(colors[token]).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('uses the palette backgrounds: warm off-white / near-black, Mint / Teal for kids', () => {
    expect(themes.personal.light.colors.background).toBe('#F5F3EC');
    expect(themes.personal.dark.colors.background).toBe('#0F1513');
    expect(themes.kid.light.colors.background).toBe('#D9F2E6');
    expect(themes.kid.dark.colors.background).toBe('#12302B');
  });

  it('maps palette roles onto tokens', () => {
    const dark = themes.personal.dark.colors;
    expect(dark.primary).toBe('#4FB596');
    expect(dark.positive).toBe('#4FB596');
    expect(dark['on-primary']).toBe('#06201A');
    expect(dark.tint).toBe('#24342F');
    expect(dark['on-warning']).toBe('#E8B558');
    expect(dark.negative).toBe('#F08A74');
    expect(dark['jar-give']).toBe('#FF86A3');
  });

  it('keeps white chips on the light kid theme only', () => {
    expect(themes.kid.light.colors.chip).toBe('#FFFFFF');
    expect(themes.kid.dark.colors.chip).toBe('#24342F');
    expect(themes.personal.light.colors.chip).toBe('#DCEBE4');
  });

  it('gives every token a Tailwind colour class backed by its CSS variable', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require('../../tailwind.config.js') as { theme: { extend: { colors: Record<string, string> } } };
    const colors = config.theme.extend.colors;
    expect(Object.keys(colors).sort()).toEqual([...COLOR_TOKENS].sort());
    for (const token of COLOR_TOKENS) expect(colors[token]).toBe(`rgb(var(--color-${token}) / <alpha-value>)`);
  });

  it('turns the active variant into NativeWind variables', () => {
    expect(themeVariables('kid', 'dark')).toMatchObject({
      '--color-background': '18 48 43',
      '--radius': '24px',
    });
    expect(themeVariables('personal', 'light')['--color-background']).toBe('245 243 236');
  });
});
