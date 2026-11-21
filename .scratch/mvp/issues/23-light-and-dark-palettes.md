# 23: Light and dark colour palettes

**What to build:** Apply the user's new light and dark palettes, add a real dark mode, and let the adult choose the appearance. The palette tables are `docs/design/mockups/palette-light.png` and `palette-dark.png`. The hex values are copied below so nothing has to be read off the images.

**Blocked by:** 20 (Design foundation), 17 (Settings).

**Status:** ready-for-agent

## Palettes

| Palette token | Light | Dark | Used for |
|---|---|---|---|
| Background | `#F5F3EC` | `#0F1513` | Personal screens |
| Card | `#FFFFFF` | `#1B2623` | Cards, rows, keypad keys |
| Text | `#1E2B27` | `#EDEFEA` | Main text |
| Muted text | `#56655F` | `#9AA7A1` | Labels and hints |
| Accent | `#1F7A63` | `#4FB596` | Buttons, the + button, progress, selected states |
| Text on accent | `#FFFFFF` | `#06201A` | Text and icons on the accent |
| Soft fill | `#DCEBE4` | `#24342F` | Chips, bar tracks, icon circles |
| Warning text | `#8A5A0B` | `#E8B558` | Negative Unallocated, Jar below zero |
| Warning fill | `#FBF0D9` | `#3A2E14` | Background of warnings |
| Over budget | `#B23E27` | `#F08A74` | Over-budget amounts and bars |
| Danger tint | `#FBE3DE` | `#3B2420` | Delete and sign-out button fill |
| Kid background | `#D9F2E6` (Mint) | `#12302B` (Teal) | Kid screens |
| Jar: Save | `#3BA776` | `#4FC08D` | Save jar |
| Jar: Spend | `#FF9F43` | `#FFB05A` | Spend jar |
| Jar: Give | `#F26B8A` | `#FF86A3` | Give jar |

## Checklist

- [ ] `apps/mobile/src/theme/themes.ts` gets light and dark variants of both the Personal and Kid themes, mapped onto the existing tokens:
  - background ← Background (Kid: Kid background)
  - surface ← Card
  - text ← Text
  - muted ← Muted text
  - primary and positive ← Accent
  - on-primary ← Text on accent
  - tint ← Soft fill
  - chip ← Soft fill (Kid light: Card, as today's white chips)
  - on-warning ← Warning text
  - warning ← Warning fill
  - negative ← Over budget
  - negative-surface ← Danger tint
  - jar-* ← Jar colours
- [ ] Tokens the palette doesn't name (`dark`/`on-dark` for the kid's dark button, `accent` for the kid avatar orange, `border`) get values that fit each palette. Pick them sensibly; the dark button must still stand out on Teal. List the chosen values in Comments for the user to confirm.
- [ ] Screens keep using token classes only. Grep for raw hex or rgb colours in `app/` and `src/` and move any to tokens. Make sure NativeWind/Tailwind tokens switch with the theme, e.g. via CSS variables or `vars()`, and not only the `useTheme()` object.
- [ ] The kid theme is now Mint (light) / Teal (dark) instead of yellow. Update `docs/design/README.md` and ticket 20's colour notes to the new palettes.
- [ ] **Appearance setting:** the app follows the phone's light/dark setting by default (`app.json` already has `userInterfaceStyle: automatic`). Settings gets an **Appearance** row with System / Light / Dark, remembered on this device only (not synced), and applied without a restart. English and Arabic strings.
- [ ] The status bar and navigation bar, the splash/background colour, and Android's system UI follow the active palette. Nothing flashes white on launch in dark mode.
- [ ] SVG icons: line icons use currentColor, so they follow text and token colours. Check the coloured `learn-illustration-*` drawings still read well on Teal and the dark Background, and note any that don't.
- [ ] Contrast: text, muted text and on-accent text meet WCAG AA (4.5:1 for body text) on their backgrounds in both palettes. Add a small unit test over the theme objects that checks these pairs, so a future palette edit can't break it silently.
- [ ] Tests and typecheck pass. Do a visual pass using an Android bundle export, and list in Comments the screens to check by hand in both modes and both languages.
