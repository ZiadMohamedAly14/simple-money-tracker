# Home figures: Unallocated from Income, Covered Other, salary shortcut

Decided in a grilling session on 2026-11-22.

## Problem

The adult's scenario: Expected Income 8,000, budgets 8,000, Income recorded 8,200, then 100 spent in Other.

- Remaining says 100 left, but Unallocated says 0 and Other says "over by 100". The screen contradicts itself.
- Setting Expected Income and then typing the same salary again as Income is tedious.

## Decisions

1. **Unallocated** = max(Expected Income, Income) − Category Budgets. May be negative. (Same "larger of" rule as Remaining.)
2. **Covered Other**: when Other's overspend (spent − budget) is above 0 and no more than Unallocated, Other shows a neutral "X spent", with no bar and no warning colour. Unallocated is not lowered: if the money is later budgeted away, the warning comes back by itself.
3. **Not covered**: when the overspend is more than Unallocated, Other shows the full "over by X", not just the uncovered part.
4. Only Other gets this. Other Categories warn as before.
5. **No automatic Income** from Expected Income: Income stays money actually recorded.
6. **Salary chip**: while Expected Income > 0 and Income < Expected Income, a chip under the Income figure reads "+ Record [Expected − Income]". Tapping it opens Add income with that amount and the note "Salary". The adult confirms or edits before saving. The chip hides once Income reaches Expected.
7. The negative-Unallocated notice reads "Budgets are X more than your income", and the Unallocated info text matches the new rule.

## Worked example (test cases)

| Expected | Income | Budgets | Other budget | Other spent | Unallocated | Other row |
|---|---|---|---|---|---|---|
| 8,000 | 8,200 | 8,000 | 0 | 100 | 200 | 100 spent (Covered) |
| 8,000 | 8,200 | 8,000 | 0 | 300 | 200 | over by 300 |
| 8,000 | 8,000 | 8,000 | 0 | 100 | 0 | over by 100 |
| 8,000 | 0 | 7,000 | 0 | 0 | 1,000 | 0 left |

Salary chip: Expected 8,000, Income 0 → "+ Record 8,000". Income 500 → "+ Record 7,500". Income 8,000 or more, or Expected 0 → no chip.
