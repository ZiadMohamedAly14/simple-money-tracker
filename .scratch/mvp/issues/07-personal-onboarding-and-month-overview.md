# 07: Personal onboarding and Month overview

**What to build:** A new adult picks "for me", a currency and their Expected Income, gets the default Categories, and lands on a home screen showing this Month's Income, Spending, Remaining and Unallocated.

**Blocked by:** 05 (Sync tracer bullet).

**Status:** ready-for-agent

- [x] Onboarding asks for purpose (personal or kid; the kid branch can stay a stub until 12), currency and Expected Income, then marks onboarding complete on the server.
- [x] Default Categories are created with translated names and a budget of 0: Housing, Food & Groceries, Transport, Bills & Utilities, Health, Shopping, Entertainment, Kids, Other.
- [x] An optional step splits Expected Income across Categories.
- [x] Month plans use a deterministic ID worked out from the Account and Month, so two offline devices creating the same Month end up with one record. A Seam B test covers this.
- [x] The home screen shows Income, Spending, Remaining and Unallocated (which can go negative), all worked out by shared functions with Seam C tests.
- [x] The home screen shows Income against Expected Income (for example "10,000 of 8,000 expected"), so extra income such as freelance work is visible. Extra income is recorded as an ordinary Income with a note; there are no income categories.
- [x] Months come from local calendar dates (Seam C tests around midnight and month ends).

## Comments

Built on `ticket/07-personal-onboarding-and-month-overview`:

- **Shared (Seam C):** `monthOf`, `currentMonth`, `formatMonth` (`dates/month.ts`; the shared Jest suite now runs at UTC+14 so a UTC-based Month would fail); `monthFigures` (Income, Spending, Remaining, Unallocated; `budget/monthFigures.ts`); `DEFAULT_CATEGORY_KEYS`. Deterministic IDs in `sync/ids.ts`: `accountSettingsId` (fixed, like `otherCategoryId`), and `monthPlanId`, `categoryBudgetId`, `defaultCategoryId`, which are UUIDv8 values built from a pure-TS SHA-256 of the Account and the fields (`sync/sha256.ts`, checked against known test vectors). The sync contract gains `accountSettings` (currency, numbering system), `monthPlan` (month, Expected Income ≥ 0) and `categoryBudget` (month, Category, amount ≥ 0). `VerifyCodeData.onboardingCompleted` is new.
- **API (Seam A):** models and sync rules for the three new entities. A record with a deterministic ID must carry the one derived from its Account and fields, or the push gets a 422. A Category Budget must reference this Account's Category. `POST /account/onboarding` sets `onboardingCompletedAt` once (calling it again does nothing; a Kid Session gets 403). Verify returns `onboardingCompleted`. The route is mounted as `/account/onboarding` in its own file so it won't collide with ticket 11's account routes.
- **Mobile (Seam B, `src/sync/onboarding.seamB.test.ts`):** local tables (migration 2). `localStore.put(records)` writes records with known IDs. `completeOnboarding(records)` writes them and marks onboarding `unreported` in one transaction. The sync engine posts `/account/onboarding` after the next successful sync. Signing in to an onboarded Account sets the state to `complete`. `src/data/budget.ts` holds `completePersonalOnboarding` (settings, the 8 default Categories with names in the device language and fixed IDs, this Month's plan), `setExpectedIncome`, `setCategoryBudgets`, and the live queries plus `monthOverviewOf`. The tests cover offline onboarding, a second device skipping onboarding, two devices onboarding offline (one set of Categories and one plan), two devices creating the same Month (one plan), the split step's Unallocated on a second device, and Income above Expected Income.
- **Screens:** `app/onboarding/` has Who is it for, currency, Expected Income and split (optional, with Skip). The kid branch is a stub that sends the parent to the personal path until ticket 12. The home screen (`app/index.tsx`) sends a new Account to onboarding and otherwise shows the Month title, Remaining, the Income/Spending/Unallocated tiles (warning surface when Unallocated is negative), "X of Y expected", the over-plan notice and the fresh-Month state. The old health screen is now `/health`, behind the settings button, and keeps language and sign-out until ticket 17. `PLACEHOLDER_CURRENCY` is gone: screens use `useAccountSettings()` (with `FALLBACK_CURRENCY` until the settings sync in).

- **Merged with `mvp` (tickets 06 and 11):** `put` and `completeOnboarding` announce writes, so 06's debounced trigger syncs them (which then reports onboarding). The onboarding screens no longer call `syncEngine.sync()` directly. Home uses `syncTriggers.refresh()` for pull to refresh, shows "Pending sync" when sync is overdue, and has the Parent Area button that used to be on the health screen. `/account/onboarding` and `/account/pin` are mounted side by side.

**Left over / for later tickets:**
- A Category Budget with amount 0 is allowed, and a missing one counts as 0, so onboarding writes no budget records.
- The amount keypad has no operators yet (ticket 08). The split step uses decimal-pad text fields.
- A Month that has no plan yet (the first Month after the onboarding Month) shows Expected Income 0. Creating Months lazily by copying the previous one is ticket 10.
- Category rows on the home screen are ticket 09, which should reuse `categoryBudgetId`, `setCategoryBudgets` and `categoryIconFor`.
- `accountSettings` is `kidCanRead: false` for now. Ticket 14 should let a Kid device read it (the Kid Wallet's currency).
- The numbering system is saved as `western` at onboarding. Ticket 17 changes it and the currency label.

**Human follow-up:**
- Check on a device, in English and Arabic: onboarding from a new Account; onboarding in airplane mode, then going online (a second device signing in should skip onboarding); a negative Unallocated; RTL layout of the tiles and the "X of Y expected" line.
- Deploy the API (new collections and `/account/onboarding`).
