# 07: Personal onboarding and Month overview

**What to build:** A new adult picks "for me", a currency and their Expected Income, gets the default Categories, and lands on a home screen showing this Month's Income, Spending, Remaining and Unallocated.

**Blocked by:** 05 (Sync tracer bullet).

**Status:** ready-for-agent

- [ ] Onboarding asks for purpose (personal or kid; the kid branch can stay a stub until 12), currency and Expected Income, then marks onboarding complete on the server.
- [ ] Default Categories are created with translated names and a budget of 0: Housing, Food & Groceries, Transport, Bills & Utilities, Health, Shopping, Entertainment, Kids, Other.
- [ ] An optional step splits Expected Income across Categories.
- [ ] Month plans use a deterministic ID worked out from the Account and Month, so two offline devices creating the same Month end up with one record. A Seam B test covers this.
- [ ] The home screen shows Income, Spending, Remaining and Unallocated (which can go negative), all worked out by shared functions with Seam C tests.
- [ ] Months come from local calendar dates (Seam C tests around midnight and month ends).
