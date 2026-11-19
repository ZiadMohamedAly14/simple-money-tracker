# 20: Design foundation (Mizan)

**What to build:** Apply the agreed visual design (`docs/design/`) to the app's foundation, so every later screen ticket composes ready-made, on-brand pieces instead of styling from scratch.

**Blocked by:** 03 (Sign in with an email code).

**Status:** resolved

- [x] Theme tokens in `apps/mobile/src/theme/themes.ts` and `tailwind.config.js` use the Mizan palette for the Personal and Kid themes, including tint, warning surface and the three Jar colors. Screens still use token classes only.
- [x] Inter (Latin) and Alexandria (Arabic) are bundled and loaded; the family follows the device language.
- [x] The display name is Mizan / ميزان (app name, translated app title, sign-in email sender name and copy). Slug and Android package are unchanged.
- [x] Shared UI pieces matching the design: button (primary, secondary/tint, dark, danger), round icon button (mirrored when directional), card, chip, numeric keypad (decimal key optional), big amount display, category/progress row, segmented control, FAB, "pending sync" label, list row with icon circle. Start/end layout only.
- [x] The existing sign-in screens (email, code) and the health screen are restyled to match PDF pages 3–4, in both languages; the code keypad has no decimal key.
- [x] Shared pure logic introduced here (if any) has Seam C tests; everything type-checks.

## Comments

Built: Mizan tokens for Personal and Kid (tint, chip, dark, warning, negative-surface, three Jar colors) in `themes.ts`/`tailwind.config.js`; Inter and Alexandria bundled via `expo-font` + `@expo-google-fonts/*`, loaded in the root layout, family picked per language by the `Text` component (`src/theme/fonts.ts`); component library in `apps/mobile/src/ui/` (Text/TextField, Button, IconButton, Fab, Card, ListRow, Chip, SegmentedControl, Notice, PendingSyncLabel, IconCircle, AmountDisplay, ProgressBar, ProgressRow, NumericKeypad, CodeBoxes, Screen, ScreenHeader); sign-in, code (boxes + in-app keypad, no decimal key, email in a direction isolate, "Resend code in 0:30") and health screens restyled; app name, email subject/copy and sender name changed to Mizan / ميزان. Seam C tests for the new shared helpers (`applyKeypadKey`, `formatMoneyParts`, `formatAmountInput`, `formatCountdown`, `ltrIsolate`) and a mobile test for `fontFamily`.

Note: the code screen no longer uses the system keyboard, so OS one-time-code autofill/paste is gone; add a paste affordance later if testers miss it.

**Human follow-up**
- Rebuild the dev client / EAS build: `expo-font` adds a config plugin, so the existing dev build needs rebuilding.
- On Railway, change `EMAIL_FROM` to `Mizan <onboarding@resend.dev>` (or the verified-domain address).
- Manual device check of the restyled screens in English and Arabic (fonts, RTL keypad order, code boxes stay LTR).
- The Android launcher label is "Mizan" in both languages; a localized Arabic launcher name (ميزان) needs native string resources and was not added.
