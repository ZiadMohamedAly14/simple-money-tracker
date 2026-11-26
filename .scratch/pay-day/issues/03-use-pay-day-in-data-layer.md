# 03: Use Pay Day boundaries everywhere Months are read

**Status:** resolved (merged to `mvp` via `pay-day`)
**Blocked by:** 01, 02

**What to build:** Replace calendar-month assumptions with the functions from 01:
- the `LIKE 'YYYY-MM-%'` queries in `apps/mobile/src/data/budget.ts` and `transactions.ts` become date-range queries,
- `monthOf` calls in `monthFigures`, `categoryBreakdown`, `useMonthSwitcher` and the Transaction write paths (`openMonth`),
- the default date when adding a Transaction to a past Month becomes that Month's last day,
- `copiedPlanEditTime` and the Month string comparisons, which must stay correctly ordered.

Expected Income and Category Budgets are copied as before (spec decision 9).

**Acceptance:** With Pay Day 26, an Expense dated 26 Nov counts in "December" and one dated 25 Nov counts in "November". The Month switcher steps through the Months in a changeover with no gaps. All existing seam tests pass with Pay Day 1.
