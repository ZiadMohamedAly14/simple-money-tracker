# 23: Light and dark colour palettes

**What to build:** Apply the user's new light and dark palettes, add a real dark mode, and let the adult choose the appearance. The palette tables are `docs/design/mockups/palette-light.png` and `palette-dark.png`. The hex values are copied below so nothing has to be read off the images.

**Blocked by:** 20 (Design foundation), 17 (Settings).

**Status:** resolved

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

- [x] `apps/mobile/src/theme/themes.ts` gets light and dark variants of both the Personal and Kid themes, mapped onto the existing tokens:
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
- [x] Tokens the palette doesn't name (`dark`/`on-dark` for the kid's dark button, `accent` for the kid avatar orange, `border`) get values that fit each palette. Pick them sensibly; the dark button must still stand out on Teal. List the chosen values in Comments for the user to confirm.
- [x] Screens keep using token classes only. Grep for raw hex or rgb colours in `app/` and `src/` and move any to tokens. Make sure NativeWind/Tailwind tokens switch with the theme, e.g. via CSS variables or `vars()`, and not only the `useTheme()` object.
- [x] The kid theme is now Mint (light) / Teal (dark) instead of yellow. Update `docs/design/README.md` and ticket 20's colour notes to the new palettes.
- [x] **Appearance setting:** the app follows the phone's light/dark setting by default (`app.json` already has `userInterfaceStyle: automatic`). Settings gets an **Appearance** row with System / Light / Dark, remembered on this device only (not synced), and applied without a restart. English and Arabic strings.
- [x] The status bar and navigation bar, the splash/background colour, and Android's system UI follow the active palette. Nothing flashes white on launch in dark mode.
- [x] SVG icons: line icons use currentColor, so they follow text and token colours. Check the coloured `learn-illustration-*` drawings still read well on Teal and the dark Background, and note any that don't.
- [x] Contrast: text, muted text and on-accent text meet WCAG AA (4.5:1 for body text) on their backgrounds in both palettes. Add a small unit test over the theme objects that checks these pairs, so a future palette edit can't break it silently.
- [x] Tests and typecheck pass. Do a visual pass using an Android bundle export, and list in Comments the screens to check by hand in both modes and both languages.

## Comments

Built on `ticket/23-light-and-dark-palettes`:

- **Palettes (`apps/mobile/src/theme/themes.ts`):** `themes[name][scheme]` now holds Personal and Kid, each in light and dark, mapped onto the existing tokens as the checklist says (Kid light keeps white chips on Mint; Kid background is Mint `#D9F2E6` / Teal `#12302B`). `COLOR_TOKENS` lists every token once; `themes.test.ts` checks all four variants define every token as a hex colour, the palette values land on the right tokens, and `tailwind.config.js` has a CSS-variable class for every token. Two tokens are new: `on-accent` (ink on the orange accent and Jar circles) and `scrim` (dialog backdrop, replaces DateField's raw `bg-black/40`).
- **Switching:** `ThemeProvider` passes the active variant to NativeWind through `vars()`, so className colours and `useTheme()` change together, with no restart. `src/theme/appearance.ts` holds the pure rules (`parseAppearance`, `activeScheme`: System follows the phone, Light when the phone gives no answer; Light/Dark win over the phone), tested in `appearance.test.ts`. `appearanceStore.ts` keeps the choice in AsyncStorage (`device.appearance`, this device only, not synced, kept on sign-out like the language) and hands it to React Native's `Appearance.setColorScheme`, so Android's night mode, system dialogs and the navigation bar buttons follow it too.
- **Settings:** an Appearance card (new `appearance` line icon) with a System / Light / Dark segmented control, under the digits card. EN/AR strings `settings.appearance*` (المظهر: النظام / فاتح / داكن).
- **System UI:** `SystemBars` sets the status bar style and the root view background (`expo-system-ui`) from the active palette. `expo-splash-screen` is configured with the light and dark Background colours, and the root layout keeps the splash up until language, session, the stored Appearance and fonts are loaded, so dark mode doesn't flash white. Pull-to-refresh spinners now sit on the surface colour instead of Android's white disc.
- **Tokens only:** `tokensOnly.test.ts` scans `app/` and `src/` for raw hex/rgb colours and Tailwind's built-in palette classes (only `themes.ts` may hold colours). It passes over the merged tickets 21 and 22 code (Category icon picker, hero card) as well.
- **Contrast (`contrast.ts`, `contrast.test.ts`):** a WCAG 2 contrast ratio over the theme objects. In all four variants it checks at 4.5:1: text on background / surface / tint / chip, muted on background / surface, on-primary on primary, primary on surface, on-dark on dark, on-warning on warning, negative on surface and on negative-surface, on-accent on accent. At 3:1 (non-text): the dark button against the screen background, and every IconCircle tone's icon against its fill. That last check caught a real bug: Jar and avatar circles drew their icons in the text colour, near-white in dark mode (about 1.6:1 on the Jar colours). `src/ui/iconCircleTones.ts` now names each tone's fill and icon tokens, and Jar/accent icons use `on-accent`.

**Values chosen for tokens the palette doesn't name (please confirm):**

| Token | Light | Dark | Why |
|---|---|---|---|
| `dark` / `on-dark` | `#1E2B27` / `#FFFFFF` | `#EDEFEA` / `#0F1513` | Kid "I spent money". Inverts to near-white in dark: 12.2:1 against Teal, so it still stands out. |
| `accent` | `#FF9F43` | `#FFB05A` | Kid avatar orange = the Spend jar orange in each palette. |
| `on-accent` | `#1E2B27` | `#0F1513` | Letter on the avatar, icons on Jar circles (4.9:1 or better on every Jar colour). |
| `border` | `#D5DFD9` | `#2E3D38` | A hairline a step off the Card colour in each palette. |
| `scrim` | `#000000` | `#000000` | Used at 40%. |

**Notes / left over:**
- Learn illustrations sit on a Card. In dark mode the near-black outlines (`#1E2B27`) almost vanish on the dark Card (1.06:1) in `learn-illustration-budget`, `-compare-prices`, `-needs-wants` and `-spending-choices`, and the green `#1F7A63` strokes are weak in all of them (3.0:1). The yellow, orange, pink and pale green fills read fine. They were not redrawn; they need dark variants (or a light backdrop behind the drawing in dark mode).
- In dark mode the Card, Soft fill and Teal/Background colours are very close (1.1–1.2:1), so cards and chips separate from the screen only faintly, especially on Teal. That's the palette as given; a lighter dark Card or a `border` on cards would help if it looks flat on a device.
- The Accent on Mint is 4.4:1, just under AA, if green text is ever put straight on the kid background (on white Cards it is 5.2:1).
- The palette says Danger tint is the sign-out button's fill too, but Settings' Sign out is still the secondary (Soft fill) button as in the PDF. Say if it should turn red-tinted.
- The splash follows the phone's setting, not the in-app choice (the stored choice isn't readable before JS starts). With the phone dark and the app set to Light, launch shows the dark splash, then the light app; no white flash.

**Human follow-up:**
- `expo-splash-screen` and `expo-system-ui` are new native modules and the splash is a config plugin: rebuild the dev client / EAS build.
- Check on a device in both modes (phone dark and light, and each Appearance choice) and both languages: launch (no white flash), Settings → Appearance switching live, status bar icons and the navigation bar, sign-in and code screens, home hero card and Unallocated row (including negative), Transactions, add/edit Expense with the DateField calendar, Categories and the icon picker, Delete/Archive confirmations, Settings (switch track, Delete account), onboarding, PIN gate, Parent Area, kid wallet on Teal (avatar letter, Jar circles and bars, "I spent money" button, low-Jar and below-zero banners), kid history, Learn (illustrations as noted above), Kid device setup, Kid devices list with pull-to-refresh.
