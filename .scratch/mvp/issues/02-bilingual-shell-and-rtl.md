# 02: Bilingual shell and right-to-left layout

**What to build:** The app runs fully in English or Arabic. Arabic uses a correct right-to-left layout, and amounts are formatted properly in both languages and in either digit style. Every later screen inherits this.

**Blocked by:** 01 (Walking skeleton).

**Status:** ready-for-agent

- [ ] i18next with expo-localization. Language is per device and defaults to the phone's language.
- [ ] Switching to or from Arabic shows "The app will restart" and reloads with the correct direction.
- [ ] NativeWind is set up with start/end classes only; direction-sensitive icons are mirrored.
- [ ] Separate Personal and Kid themes, with colors defined as tokens so branding can be swapped in later.
- [ ] Shared money helpers convert to and from the smallest unit and format with `Intl` for the chosen language, currency and numbering system (Western by default, Arabic-Indic optional), with Seam C tests.
- [ ] The health screen from 01 renders correctly in both directions.
