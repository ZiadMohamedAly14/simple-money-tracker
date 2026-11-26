# 04: Pay Day in Settings with a changeover preview

**Status:** resolved (merged to `mvp` via `pay-day`)
**Blocked by:** 03

**What to build:** A Pay Day entry in Settings with a picker for days 1–31 (31 labelled "Last day of the month"), plus the advice to choose the earliest day you usually get paid. Before saving, a preview of both changeover options. "Start after this Month" is preselected, and "Start now" is shown only when it is allowed. While a change is pending, show "1st → 25th from 1 Dec". The Month screen shows the date range under the Month name. All text is in English and Arabic.

**Acceptance:** The worked changeover examples in `../spec.md` show matching previews.

## Comments

- **2026-11-26 (agent):** Built without a screen design, at the user's request. `docs/design/` has no mockup for Pay Day, so the screens reuse existing patterns: a Settings `ListRow` (calendar icon, the Pay Day or the pending change as its subtitle) opens `app/settings/pay-day.tsx`, which follows the currency sub-screen. It has an advice `Notice`, day chips (1–30, plus a wide "Last day of the month" chip), and one selectable card per changeover option listing each Month and its dates. "Start after this Month" is preselected, and Save is in the footer. The Month screen shows the dates in muted small text under the name. A designer should review all of this once a mockup exists.
- Dates use the app's `Intl` formatting, so English shows "Dec 1" (en-US order) rather than the spec's "1 Dec". Ranges write both ends in full ("Nov 1 – Nov 24"), so the order holds in every locale.
- The pending line uses the Bridge Month's first day ("1st → 25th from Dec 1") until the Bridge Month starts, then the first day on the new Pay Day. After a "Start now" change it uses that first day too.
- Picking the Pay Day that is already in force while a change is pending cancels the pending change. It doesn't add a duplicate entry.
- The shared `PayDayPicker` (`src/ui/PayDayPicker.tsx`) and `payDayLabel` (`src/i18n/payDayLabel.ts`) also drive the onboarding step from ticket 05.
