# 20: Design foundation (Mizan)

**What to build:** Apply the agreed visual design (`docs/design/`) to the app's foundation, so every later screen ticket composes ready-made, on-brand pieces instead of styling from scratch.

**Blocked by:** 03 (Sign in with an email code).

**Status:** resolved

- [x] Theme tokens in `apps/mobile/src/theme/themes.ts` and `tailwind.config.js` use the Mizan palette for the Personal and Kid themes, including tint, warning surface and the three Jar colors. Screens still use token classes only. (Ticket 23 replaced these colours with the light and dark palettes, and the Kid background is now Mint / Teal instead of yellow; see `docs/design/README.md`.)
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

**Custom icons (chore/svg-icons, chore/icons-round-2)**: the icon set is complete. The app's own SVG icons live in `apps/mobile/assets/icon/` and import as components through `react-native-svg` + `react-native-svg-transformer` (SVGO strips the C2PA metadata at build time; `.svgrrc.js`). Draw one with `<AppIcon name="add" size={22} color={theme.colors.primary} />` (name = file name, typed as `AppIconName`; colour defaults to the theme text colour). Line icons draw in `currentColor`; `learn-illustration-*` are coloured illustrations and ignore `color`. `back`, `chevron-forward` and `move-money` mirror in RTL; `chevron-up`/`chevron-down` don't. For a "previous" arrow use `chevron-forward` with `reversed` (on `AppIcon`, `Glyph` and `IconButton`): it points toward the start of the line in both directions, as on the home month switcher and the DateField month arrows. Every UI-kit icon prop (`IconCircle`, `Button`, `IconButton`, `Fab`, `ListRow`, `ProgressRow`, `Notice`) takes a `GlyphName`: `app:<file name>` (e.g. `icon="app:wallet"`), or still an Ionicons name, though no screen uses Ionicons any more. A new .svg needs a line in `src/ui/appIcons.ts`; `appIcons.test.ts` checks the registry matches the folder, that line icons use only `currentColor`, and that the SVGO config strips C2PA metadata from every file.
Icons in use: Categories use `app:housing`, `app:food-groceries`, `app:transport`, `app:bills-utilities`, `app:health`, `app:shopping-spend`, `app:entertainment`, `app:kids`, `app:other`, and `app:tag` for Categories the adult added (`src/data/categoryIcons.ts`). Also `edit`, `settings`, `spending`, `currency`, `info`, `cloud`, `calendar` (DateField), `archive`, `restore`, `selected` (chosen ListRow), `backspace` (keypad), `close` (ScreenHeader), `language`, `digits`, `exit` (Sign out), `pending-sync` (`PendingSyncLabel`). Learn lessons name their drawing in `LESSON_ILLUSTRATIONS` (`src/learn/lessons.ts`).
Reserved for upcoming tickets (registered, not used yet): `email`, `devices`, `revoke-device`, `key`, `note` (`RESERVED_APP_ICONS`); the transaction note field has no icon slot yet, so `note` waits for one. Also drawn but with no screen spot yet: `more`, `pie-chart`, `success`, `charity-hand-coin`, `kid-device`, `monthly-bills`, `move-money`, `reorder-history`.
- Rebuild the dev client / EAS build: `react-native-svg` is a new native module, so a dev build made before chore/svg-icons will crash on the first SVG icon.
