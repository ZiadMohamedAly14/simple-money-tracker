# 22: Home hero card for Remaining

**What to build:** Replace the home screen's Remaining / Income / Spending / Unallocated tiles with the "Hero card" design the user chose. The mockup is at `docs/design/mockups/home-hero-card.png`.

**Blocked by:** 07 (Month overview), 10 (Month navigation).

**Status:** ready-for-agent

- [ ] One bold card in the theme's primary green with rounded corners, showing:
  - a "Remaining" label with the `app:wallet` icon;
  - Remaining (Income − Spending) as a very large number, with the currency code smaller beside it;
  - an income progress bar: Income received ÷ Expected Income, clamped to 0–100%, light track with a white fill;
  - a caption below the bar: "2,000.00 of 8,000.00 expected".
- [ ] Inside the card, two translucent tiles side by side: **Income** (`app:income-money`) and **Spending** (`app:spending`), each with its amount.
- [ ] Below the card, a separate white row: **Unallocated** (`app:pie-chart` or `app:unallocated`) with its amount at the end. When Unallocated is negative, the row keeps the existing warning style and `app:gentle-warning`.
- [ ] Negative Remaining stays readable on the green card, with a clear minus sign; don't rely on a red-on-green colour. With no Expected Income (0), the bar and caption are hidden or show a sensible empty state, never a divide by zero.
- [ ] Works right to left: the label, icon and tiles mirror, and the bar fills from the start edge. Numbers sit inside direction isolates and use the chosen numbering system. Amounts use the Account currency and the existing formatting helpers.
- [ ] Follows the Month chosen in the month switcher (ticket 10), and keeps the existing over-plan notice and Categories card below.
- [ ] Theme tokens only (no hard-coded hex), so dark mode and the Kid theme don't break. Screen-reader labels read each figure ("Remaining, 1,870 EGP").
- [ ] Update `docs/design/README.md`'s home screen description to the hero card, and remove the replaced `FigureTile` code if nothing else uses it.
- [ ] If the figures or progress need any new logic (e.g. the progress ratio), put it in shared code with Seam C tests.
