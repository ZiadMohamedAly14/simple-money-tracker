# 22: Home hero card for Remaining

**What to build:** Replace the home screen's Remaining / Income / Spending / Unallocated tiles with the "Hero card" design the user chose. The mockup is at `docs/design/mockups/home-hero-card.png`.

**Blocked by:** 07 (Month overview), 10 (Month navigation).

**Status:** resolved

- [x] One bold card in the theme's primary green with rounded corners, showing:
  - a "Remaining" label with the `app:wallet` icon;
  - Remaining (Income − Spending) as a very large number, with the currency code smaller beside it;
  - an income progress bar: Income received ÷ Expected Income, clamped to 0–100%, light track with a white fill;
  - a caption below the bar: "2,000.00 of 8,000.00 expected".
- [x] Inside the card, two translucent tiles side by side: **Income** (`app:income-money`) and **Spending** (`app:spending`), each with its amount.
- [x] Below the card, a separate white row: **Unallocated** (`app:pie-chart` or `app:unallocated`) with its amount at the end. When Unallocated is negative, the row keeps the existing warning style and `app:gentle-warning`.
- [x] Negative Remaining stays readable on the green card, with a clear minus sign; don't rely on a red-on-green colour. With no Expected Income (0), the bar and caption are hidden or show a sensible empty state, never a divide by zero.
- [x] Works right to left: the label, icon and tiles mirror, and the bar fills from the start edge. Numbers sit inside direction isolates and use the chosen numbering system. Amounts use the Account currency and the existing formatting helpers.
- [x] Follows the Month chosen in the month switcher (ticket 10), and keeps the existing over-plan notice and Categories card below.
- [x] Theme tokens only (no hard-coded hex), so dark mode and the Kid theme don't break. Screen-reader labels read each figure ("Remaining, 1,870 EGP").
- [x] Update `docs/design/README.md`'s home screen description to the hero card, and remove the replaced `FigureTile` code if nothing else uses it.
- [x] If the figures or progress need any new logic (e.g. the progress ratio), put it in shared code with Seam C tests.

## Comments

Built on `ticket/22-home-hero-card`:

- **Shared (Seam C):** `incomeProgress({ income, expectedIncome })` (`packages/shared/src/budget/incomeProgress.ts`): Income ÷ Expected Income clamped to 0–1, or `null` when Expected Income is 0, so the screen hides the bar instead of dividing by zero. Tests cover a partial share, no Income yet, Income above the plan, and no Expected Income.
- **Screen (`apps/mobile/app/index.tsx`):** `HeroCard` (primary green, `rounded-theme`): `app:wallet` + "Remaining", Remaining in `text-5xl` with the currency label smaller beside it, the income bar and the "X of Y expected" caption. With no Expected Income it shows "No expected income set for this month" instead. Inside the card are two `HeroTile`s (Income `app:income-money`, Spending `app:spending`) on `bg-on-primary/15`. Under the card is `UnallocatedRow` (white, `app:pie-chart`; warning surface and `app:gentle-warning` when negative). The over-plan notice, empty state and Categories card below are unchanged. `FigureTile` is removed (nothing else used it).
- `ProgressBar` gained `onPrimary` (translucent `on-primary` track, `on-primary` fill) for bars drawn on the green card. Only theme tokens are used (`bg-primary`, `bg-on-primary/15`, `bg-on-primary/25`, `text-on-primary`), so the Kid theme's tokens still apply.
- Every number sits in an LTR isolate and uses the Account currency and numbering system through `formatMoneyParts`. A negative Remaining shows Intl's minus sign in on-primary white (no red on green). Screen-reader labels use the new `home.figure` string ("Remaining, 1,870.00 EGP"; Arabic uses "،"). New EN/AR strings: `home.noExpectedIncome`, `home.figure`.
- `docs/design/README.md` describes the hero card and calls Unallocated a row instead of a tile.

Left over / notes:
- `themes.ts` has no dark-mode palette yet, so dark mode couldn't be checked. The card uses tokens only, so it will follow whatever palette is added later.
- Screens are tested by hand, as the spec says. No automated UI test was added.

**Human follow-up:**
- Check on a device, in English and Arabic (both numbering systems): the card layout against the mockup; a negative Remaining (spend more than you've received) keeps its minus sign at the start of the number, including with Arabic-Indic digits; the bar fills from the right in RTL; a Month with Expected Income 0 shows the empty line and no bar; a negative Unallocated shows the warning row and the over-plan banner; TalkBack reads each figure as "label, amount".
