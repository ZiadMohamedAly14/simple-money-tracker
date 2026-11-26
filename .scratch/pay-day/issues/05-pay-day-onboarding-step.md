# 05: "When do you get paid?" setup step

**Status:** resolved (merged to `mvp` via `pay-day`)
**Blocked by:** 03

**What to build:** One optional step in personal setup, before Expected Income, defaulting to 1st / not sure. The first Month written by `completePersonalOnboarding` is the current Month under the chosen Pay Day. Accounts that have already finished setup don't see it.

**Acceptance:** Setting up on 23 Nov with Pay Day 26 creates the plan for "November" (26 Oct – 25 Nov).

## Comments

**2026-11-26 (implementation, branch `pay-day-05`):** Built without a screen design, at the user's request. `docs/design/` still has no mockup for "When do you get paid?", so `app/onboarding/pay-day.tsx` reuses the currency step's layout. It shows the step count, a title and advice, a "1st / not sure" row (preselected), chips for days 2–30, a "Last day of the month" row, and a muted line previewing the first Month's name and dates. The picker lives in the screen file on purpose. Ticket 04 builds the reusable Pay Day picker and the day-label helper, and the two should be unified after both merge. The screen still needs a design pass once a mockup exists.

- Personal steps are now 5: purpose, currency, Pay Day, Expected Income, split. The kid path is unchanged.
- `completePersonalOnboarding` now takes `payDay` and `today` in place of `month`, and returns the Month it planned. It writes the Pay Day history record in the same onboarding write as account settings and the first Month plan, so `savePayDayHistory`'s `'not_ready'` case never comes up here. Pay Day 1 writes no history. The history comes from the new shared `setupPayDayHistory(payDay, today)`: one entry starting on the first day of the current Month under that Pay Day.
- Accounts that already finished setup never see the step, because the onboarding layout redirects them away.
