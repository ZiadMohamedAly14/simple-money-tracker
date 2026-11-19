# 10: Month navigation and review

**What to build:** An adult moves between Months, reviews and corrects past Months, and a new Month starts from the previous one's plan.

**Blocked by:** 09 (Categories and Category Budgets).

**Status:** ready-for-agent

- [ ] A Month switcher on the home screen goes to previous Months and back.
- [ ] A Month is created lazily, on first open or first Transaction, by copying the previous Month's Expected Income and Category Budgets (Seam C tests). Nothing carries over.
- [ ] Past Months show archived Categories that were used in them.
- [ ] Transactions can be recorded or edited with dates in earlier Months.
