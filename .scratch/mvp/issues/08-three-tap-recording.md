# 08: Three-tap Expense and Income recording

**What to build:** An adult records an Expense in about three taps, records Income, and can review, edit and delete the Month's Transactions.

**Blocked by:** 07 (Personal onboarding and Month overview).

**Status:** ready-for-agent

- [ ] Tapping + opens an amount keypad with focus already in it. Category chips are ordered by most recent use, and Save completes the Expense in three taps.
- [ ] Adult amount keypads (Expense, Income, Expected Income, Category Budget, Top-up, Jar Transfer) have `+ − × ÷` keys. The amount line shows the expression as typed with the live result below it; Save records the result. There is no `=` key.
- [ ] Expressions use normal calculator order (× and ÷ before + and −), no brackets, evaluated in whole minor units (ADR-0004) by a shared function with Seam C tests. A fractional result is rounded half-up to the minor unit.
- [ ] Save is disabled while the result is zero, negative, or the expression is incomplete (for example `120+`) or divides by zero.
- [ ] The expression is shown left-to-right inside a direction isolate in Arabic too, with digits in the chosen numbering system.
- [ ] The child's Kid Expense keypad has no operators. PIN and code keypads stay digits only.
- [ ] The date defaults to today and can be changed; the note is optional.
- [ ] Income entry takes an amount, a date and an optional note, with no Category.
- [ ] The Month's Transaction list allows editing and deleting any Transaction.
- [ ] Everything works in airplane mode and syncs to a second device.
