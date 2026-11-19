# 02: Bilingual shell and right-to-left layout

**What to build:** The app runs fully in English or Arabic. Arabic uses a correct right-to-left layout, and amounts are formatted properly in both languages and in either digit style. Every later screen inherits this.

**Blocked by:** 01 (Walking skeleton).

**Status:** ready-for-agent

- [x] i18next with expo-localization. Language is per device and defaults to the phone's language.
- [x] Switching to or from Arabic shows "The app will restart" and reloads with the correct direction.
- [x] NativeWind is set up with start/end classes only; direction-sensitive icons are mirrored.
- [x] Separate Personal and Kid themes, with colors defined as tokens so branding can be swapped in later.
- [x] Shared money helpers convert to and from the smallest unit and format with `Intl` for the chosen language, currency and numbering system (Western by default, Arabic-Indic optional), with Seam C tests.
- [x] The health screen from 01 renders correctly in both directions.

## Comments

Built:
- `packages/shared`: `toMinorUnits` (parses typed text, accepts Arabic-Indic/Persian digits and `٫`/`٬`, returns null when invalid), `fromMinorUnits`, `formatMoney` (Intl with `<lang>-u-nu-latn|arab`), `currencyMinorDigits`, plus `resolveLanguage`, `isRtl`, `directionChanges`, `intlLocale`, `Language`, `NumberingSystem` (`western` default, `arabic-indic`). Seam C tests.
- `apps/mobile/src/i18n`: typed `en`/`ar` strings, `startI18n()` (stored choice, else the phone's language; forces the native direction and reloads once if it doesn't match), `switchLanguage()` (restart notice and `reloadAppAsync` when the direction flips), `useFormatMoney()`.
- NativeWind v4 (Tailwind 3.4) with color, radius and control-height tokens. `src/theme/themes.ts` has the Personal and Kid themes, `ThemeProvider` applies them, `DirectionalIcon` mirrors chevrons and arrows in RTL. `src/theme/startEndOnly.test.ts` fails on left/right classes or style keys.
- The health screen is localized and shows a formatted sample amount, a mirrored chevron and the language switch. Its bundle builds (`expo export`); the RTL rendering is not yet checked by eye.

**Human follow-up:**
- Manual RTL visual pass on a device or emulator. Needs a new dev client build because native modules were added (expo-localization, reanimated, worklets, async-storage). Switch English <-> Arabic, confirm the restart notice, the reload, the mirrored chevron and the layout direction; also try an Arabic phone with English chosen.
- Final branding colors go in `apps/mobile/src/theme/themes.ts` (placeholders now).
