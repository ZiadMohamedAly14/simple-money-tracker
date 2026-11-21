# 08: Three-tap Expense and Income recording

**What to build:** An adult records an Expense in about three taps, records Income, and can review, edit and delete the Month's Transactions.

**Blocked by:** 07 (Personal onboarding and Month overview).

**Status:** ready-for-agent

- [x] Tapping + opens an amount keypad with focus already in it. Category chips are ordered by most recent use, and Save completes the Expense in three taps.
- [ ] Adult amount keypads (Expense, Income, Expected Income, Category Budget, Top-up, Jar Transfer) have `+ − × ÷` keys. The amount line shows the expression as typed with the live result below it; Save records the result. There is no `=` key.
- [x] Expressions use normal calculator order (× and ÷ before + and −), no brackets, evaluated in whole minor units (ADR-0004) by a shared function with Seam C tests. A fractional result is rounded half-up to the minor unit.
- [x] Save is disabled while the result is zero, negative, or the expression is incomplete (for example `120+`) or divides by zero.
- [x] The expression is shown left-to-right inside a direction isolate in Arabic too, with digits in the chosen numbering system.
- [x] The child's Kid Expense keypad has no operators. PIN and code keypads stay digits only.
- [x] The date defaults to today and can be changed; the note is optional.
- [x] Income entry takes an amount, a date and an optional note, with no Category.
- [x] The Month's Transaction list allows editing and deleting any Transaction.
- [x] Everything works in airplane mode and syncs to a second device.

## Comments

Built on `ticket/08-three-tap-recording`:

- **Shared (Seam C):** `evaluateAmountExpression(expression, currency)` (`keypad/expression.ts`) returns `ok` with the amount in minor units, or `incomplete`, `divisionByZero`, `tooLarge` or `invalid`. It works on exact BigInt fractions and rounds only the final result, half-up, so `10÷3+10÷3+10÷3` comes to exactly 10.00. `applyKeypadKey` has operator keys (`plus`, `minus`, `times`, `divide`) and a new `expression` mode. In that mode the amount rules (fraction digits, the size cap) apply to each number. A second operator replaces the first, a leading operator is ignored (so no negative numbers), and a dangling `.` is dropped. The `amount` mode (the child's keypad) and `digits` mode (PIN, code) ignore operator keys. `formatAmountExpression` shows `1,200 + 35 × 2` inside a left-to-right isolate, with digits in the chosen numbering system. Internally an expression uses ASCII `+ - * /`.
- **Mobile data (Seam B, `src/sync/transactions.seamB.test.ts`):** `recordIncome`, `editIncome` (its type has no Category field, so Income can't be given one), and `deleteTransaction` (renamed from `deleteExpense`). `monthTransactionListQuery(db, month)` lists Income and Expenses, newest date first. `transactionQuery(db, id)` reads one Transaction. `categoryChoicesQuery` (in 09's `src/data/categories.ts`) uses the same active-Category filter as `activeCategoriesQuery` (no Archived ones). It puts the most recently recorded-against first, ranked by the Expense's UUIDv7 ID so a use on any device counts, then the unused ones in display order with Other last. A deleted Expense doesn't count as a use. The tests cover: offline Income reaching a second device and counting in the Month; offline edits to an Income and an Expense, including moving one into an earlier Month; offline deletes on both devices; chip order across devices with an Archived Category; a deleted Expense not counting.
- **UI kit:** `NumericKeypad` takes `showOperators`, which adds a tint `÷ × − +` column at the end side. It is off by default, so the PIN, code and future kid keypads have no operators. `useAmountEntry` + `AmountEntryDisplay` + `AmountKeypad` (`src/ui/AmountEntry.tsx`): a plain amount shows big; a sum shows as typed, with "Comes to X" below it (or "Can't divide by zero" / "That amount is too large"). `amount` is null unless the result is above zero. `DateField` is a date pill ("Today", "Yesterday", "5 Mar") that opens an in-app month calendar, so no new native module is needed. Any date can be picked, including earlier Months. Weeks start on Saturday in Arabic and Sunday in English. `Chip` takes an optional `icon`. `useDateLabel` formats Transaction dates.
- **Screens:** `app/transactions/index.tsx` lists this Month's Transactions with Category icons. Income rows show the note, or "Income" (design flaw 6), with a `+` amount in the positive tone. It has an "Add income" button, a + FAB, pull to refresh and "Pending sync". `app/transactions/new.tsx` (`?kind=income` for Income) and `app/transactions/[id].tsx` (edit, plus a Delete button with a confirmation, design flaw 11; it says so if another device deleted the Transaction) share `src/transactions/TransactionForm.tsx`. Home's FAB opens a new Expense. "Add income" and "Transactions" buttons replace the ticket-05 Expenses button, and `app/expenses/` is gone. The onboarding Expected Income step and 09's `app/categories/income.tsx` now take sums. Expected Income may be 0, so those two screens accept a result of 0 or more. Icons come from the custom set: Category chips and rows use `categoryIconFor`, and the screens use `app:add`, `app:income-money`, `app:reorder-history` and `app:delete`.
- **Three taps:** + → type the amount → tap a Category chip → Save. No chip is selected at first, so an Expense never goes into a Category silently. Save stays disabled until a chip is chosen.

**Left over:**
- **Category Budget keypad:** 09's `app/categories/edit.tsx` and the onboarding split step use decimal-pad text fields, not the in-app keypad, so they don't take sums yet. Moving them to `AmountKeypad` changes their layout (the edit screen has a name field too), so I left it for a follow-up instead of reworking 09's screen here. That's why the "adult amount keypads" item isn't ticked.
- **Top-up and Jar Transfer keypads (tickets 12, 13):** 12's `src/kid/TopUpForm.tsx` (merged after this ticket was built) still uses `amount` mode without operators. Its one keypad types either the total or a Jar's share, so moving it to `expression` mode (with `evaluateAmountExpression` instead of `toMinorUnits`, and `showOperators`) is a follow-up. Jar Transfer (13) should use `useAmountEntry` / `AmountEntryDisplay` / `AmountKeypad`. The Kid Expense keypad (13) should use `NumericKeypad` without `showOperators`, in `amount` mode.
- There is no swipe to delete. Deleting is on the edit screen (design flaw 11 allows that), so no gesture library was added.
- Future dates aren't blocked; the spec doesn't say whether they should be.
- The Transactions screen shows the current Month only. Switching Months is ticket 10.

**Human follow-up:**
- Check on a device, in English and Arabic (Western and Arabic-Indic digits): + → amount → chip → Save; a sum like `120+35` and `300÷3` with its live result; Save disabled for `120+`, `5-8`, `5÷0`; the expression staying left to right in Arabic; the operator column at the end side in RTL; the calendar (picking a date in an earlier Month); Income rows; edit and delete; recording in airplane mode and seeing it on a second device.
- No new native modules, but the dev client must already include `react-native-svg` (from the icon set).
