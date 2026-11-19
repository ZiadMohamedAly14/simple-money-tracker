/**
 * Colors are CSS variables set per theme (src/theme/themes.ts), so the
 * Personal and Kid themes, and later branding, swap without touching screens.
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
        accent: token('accent'),
        positive: token('positive'),
        negative: token('negative'),
        border: token('border'),
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
