# 10: Month navigation and review

**What to build:** An adult moves between Months, reviews and corrects past Months, and a new Month starts from the previous one's plan.

**Blocked by:** 09 (Categories and Category Budgets).

**Status:** resolved

- [x] A Month switcher on the home screen goes to previous Months and back.
- [x] A Month is created lazily, on first open or first Transaction, by copying the previous Month's Expected Income and Category Budgets (Seam C tests). Nothing carries over.
- [x] Past Months show archived Categories that were used in them.
- [x] Transactions can be recorded or edited with dates in earlier Months.

## Comments

Built on `ticket/10-month-navigation-and-review`:

- **Shared (Seam C):** `addMonths(month, n)` (`dates/month.ts`) for the switcher's steps across year ends. `newMonthPlan` (`budget/newMonthPlan.ts`) works out the plan a new Month starts with: the Expected Income and Category Budgets of the **latest earlier Month with a plan** (so skipped Months still copy something sensible, and a later Month is never the source). It drops the budgets of Archived or deleted Categories (ticket 09's note) and zero budgets (a missing one already counts as 0). It returns null when the Month already has a plan, or no earlier Month has one (before onboarding), and then nothing is created. Only the plan is copied. Transactions and leftover money never carry over.
- **Mobile (Seam B, `src/sync/months.seamB.test.ts`):** `openMonth(store, db, month)` in `src/data/budget.ts` creates the Month with the deterministic `monthPlanId`/`categoryBudgetId`. `localStore.put` gained `{ asDefault: true }`, which writes the copied records with **edit time 0**, so last edit wins always prefers a real edit. A device opening a Month late (offline, behind on sync) can't overwrite an Expected Income or budget another device already changed. The outbox entry still uses the real time, so the pending-sync indicator isn't affected. The tests cover: the copy, with nothing carrying over; reopening writes nothing; Archived Categories not copied but still shown in the past Month they were used in; two offline devices opening the same Month (one plan, one set of budgets); a late open losing to an earlier edit on another device (checked to fail without `asDefault`); a first Transaction creating its Month; recording in an earlier Month and moving an Expense there by editing its date (synced to a second device); and moving an Expense into a Month with no plan.
- **First Transaction:** `recordExpense` and `editExpense` now take `db` as well, `(store, db, …)` like `categoryActions(store, db)`, and open the Month of the date (for an edit, only once the edit has landed). Callers updated: `app/expenses/new.tsx` and `testDevice`.
- **Screens:** home (`app/index.tsx`) has round arrow buttons either side of the Month name (`chevron-back`/`chevron-forward`, mirrored in RTL, with "Previous month"/"Next month" labels). They go back to the earliest Month with a plan or a Transaction and forward to the current Month (`src/data/useMonthSwitcher.ts`). Each Month shown is opened, so the current Month now starts from the previous plan, which fixes ticket 07's "Expected Income 0" note. It also re-runs when plans sync in on a new device. A past Month with no Transactions shows "Nothing recorded" instead of "A fresh month". The Categories edit button passes the Month, and `app/categories/index.tsx` reads a `month` param, so budgets and Expected Income edited from a past Month go to that Month. Past Months list the Archived Categories they used, through ticket 09's `categoryBreakdown` rule.

**Left over / notes for other tickets:**
- **Ticket 08 (merge note):** `recordExpense`/`editExpense` now take `(store, db, …)` and call `openMonth`. Any new Income or Transaction write functions should do the same. The date picker that lets a screen record or edit with an earlier date is 08's. The data layer here already supports it. When the adult adds from home while viewing a past Month, 08 may want to default the date into that Month (home could pass `month` to `/expenses/new`).
- The selected Month resets to the current one when home remounts. It doesn't stay current across midnight while the app is open.
- A Month before the first plan (e.g. one reached only by a back-dated Transaction) has no plan to copy, so it shows Expected Income 0 until the adult sets one.

**Human follow-up:**
- Check on a device, in English and Arabic: the arrows point the right way in RTL and are disabled at each end; going back through Months shows their figures and Archived Categories; editing a past Month's Expected Income or budgets from the Categories screen; a new Month (change the device date to the next month) starting from the previous plan with Remaining 0.
