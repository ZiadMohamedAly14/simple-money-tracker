# 20: Design foundation (Mizan)

**What to build:** Apply the agreed visual design (`docs/design/`) to the app's foundation, so every later screen ticket composes ready-made, on-brand pieces instead of styling from scratch.

**Blocked by:** 03 (Sign in with an email code).

**Status:** ready-for-agent

- [ ] Theme tokens in `apps/mobile/src/theme/themes.ts` and `tailwind.config.js` use the Mizan palette for the Personal and Kid themes, including tint, warning surface and the three Jar colors. Screens still use token classes only.
- [ ] Inter (Latin) and Alexandria (Arabic) are bundled and loaded; the family follows the device language.
- [ ] The display name is Mizan / ميزان (app name, translated app title, sign-in email sender name and copy). Slug and Android package are unchanged.
- [ ] Shared UI pieces matching the design: button (primary, secondary/tint, dark, danger), round icon button (mirrored when directional), card, chip, numeric keypad (decimal key optional), big amount display, category/progress row, segmented control, FAB, "pending sync" label, list row with icon circle. Start/end layout only.
- [ ] The existing sign-in screens (email, code) and the health screen are restyled to match PDF pages 3–4, in both languages; the code keypad has no decimal key.
- [ ] Shared pure logic introduced here (if any) has Seam C tests; everything type-checks.
