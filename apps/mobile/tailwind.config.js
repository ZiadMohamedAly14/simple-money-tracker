/**
 * Colors are CSS variables set per theme (src/theme/themes.ts), so the
 * Personal and Kid themes (Mizan palette) swap without touching screens.
 * Text weight and font come from the <Text weight> component in src/ui, not
 * font-* classes (custom fonts on Android ignore fontWeight).
 * Layout must use start/end classes only (ms/me/ps/pe/start/end/text-start…);
 * src/theme/startEndOnly.test.ts fails on left/right classes.
 * @type {import('tailwindcss').Config}
 */
const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: token('background'),
        surface: token('surface'),
        text: token('text'),
        muted: token('muted'),
        primary: token('primary'),
        'on-primary': token('on-primary'),
        tint: token('tint'),
        chip: token('chip'),
        dark: token('dark'),
        'on-dark': token('on-dark'),
        warning: token('warning'),
        'on-warning': token('on-warning'),
        positive: token('positive'),
        negative: token('negative'),
        'negative-surface': token('negative-surface'),
        accent: token('accent'),
        border: token('border'),
        'jar-save': token('jar-save'),
        'jar-spend': token('jar-spend'),
        'jar-give': token('jar-give'),
      },
      borderRadius: {
        theme: 'var(--radius)',
      },
      minHeight: {
        control: 'var(--control-height)',
      },
    },
  },
  plugins: [],
};
