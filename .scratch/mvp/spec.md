# Money Tracker MVP

Status: ready-for-agent

## Problem Statement

Adults who want to understand their money often give up on budgeting because the tools feel like accounting software. They want quick answers to a few simple questions: how much came in this Month, how much went out, how much is left, and where it went. Recording an expense should be fast enough that they actually do it, including when they're offline.

Parents also want to teach their children basic money habits. Children don't have bank accounts or email addresses, and parents don't want to hand them a real payment app. Parents need a safe, virtual way to give a child money, let the child see and record how they use it, and keep control of the funding.

Many target users are Arabic speakers, so the app has to feel native in Arabic (right-to-left layout, the expected digits and formatting) as well as in English.

## Solution

A mobile app (Android first) with one adult **Account**, signed into by email one-time code, and two experiences:

- **Personal Budget:** the adult sets an **Expected Income** for each **Month**, splits it into **Category Budgets**, and records **Income** and **Expense** **Transactions**. The home screen shows Income, Spending, **Remaining** and **Unallocated** for the Month, and Spent and remaining for each **Category**. Each Month starts fresh; past Months stay available to review.
- **Kid Wallet:** the adult creates **Kid Profiles**. Each one has a **Kid Wallet** split into **Jars** (Save, Spend and Give by default). The parent adds money with **Top-ups** split across Jars and can move money with **Jar Transfers**. The child records **Kid Expenses** from a Jar, sees their history, and reads short **Learn** lessons. A child can use their own device in **Kid Mode**, set up by the parent and protected by a **Parent PIN** or biometrics.

All money is virtual. Everything works offline, and changes sync between devices when a connection is available. English and Arabic are both supported fully from day one.

## User Stories

### Sign-in and Account

1. As an adult, I want to sign in with only my email and a one-time code, so that I don't have to remember a password.
2. As an adult, I want my Account created automatically the first time I verify a code, so that sign-up is a single step.
3. As an adult, I want to stay signed in across app restarts, so that I don't re-enter codes constantly.
4. As an adult, I want to keep using the app offline even if I haven't connected for weeks, so that a lack of signal never locks me out of my own data.
5. As an adult whose sign-in has expired, I want my local data to stay visible while I'm asked for a new code before syncing, so that nothing is lost.
6. As an adult, I want to be told when I've requested too many codes, so that I understand why no new code arrives.
7. As an adult, I want to sign out of a device, so that someone else using it can't see my data.
8. As an adult, I want to delete my Account and all its data after confirming with an email code, so that my financial data is truly gone.
9. As an adult, I want to use the same Account on several devices, so that my phone and tablet show the same budget.

### Onboarding

10. As a new adult, I want to choose whether the app is mainly for me or for a kid, so that I land on the right home screen.
11. As a new adult, I want to pick my currency once, so that every amount is shown correctly.
12. As a new personal user, I want to enter my Expected Income, so that I can start budgeting straight away.
13. As a new personal user, I want a sensible set of default Categories (Housing, Food & Groceries, Transport, Bills & Utilities, Health, Shopping, Entertainment, Kids, Other), so that I don't start from a blank screen.
14. As a new personal user, I want an optional step to split my Expected Income across Categories, so that I can set budgets right away or skip it.
15. As a new parent choosing the kid path, I want to create a Kid Profile, set a Parent PIN and optionally add a first Top-up, so that the device is ready for my child.
16. As a parent who started on the kid path, I want my Personal Budget to still exist for later, so that I never need a second Account.
17. As a personal user, I want to turn on the kid experience later without creating another Account, so that the app grows with my needs.

### Personal Budget: viewing

18. As an adult, I want the home screen to show this Month's Income, Spending and Remaining, so that I know where I stand at a glance.
19. As an adult, I want to see Unallocated, which can go negative, so that I notice when my Category Budgets exceed my Expected Income.
19a. As an adult who earns more than expected (for example freelance work on top of my salary), I want to see Income against my Expected Income, so that I notice the extra and can raise Expected Income if I want to budget it.
20. As an adult, I want each Category to show its budget, amount spent and amount remaining, so that I know where my money is going.
21. As an adult, I want to switch to previous Months and see their figures, so that I can review my history.
22. As an adult, I want a new Month to start with my previous Month's Expected Income and Category Budgets, so that I don't have to set them up again.
23. As an adult, I want unused money to stay behind rather than roll into the next Month, so that each Month is a clean slate.
24. As an adult, I want Remaining always worked out from my Transactions, so that I can trust the number and never have to type in a balance.
25. As an adult, I want a list of a Month's Transactions, so that I can see exactly what happened.

### Personal Budget: recording

26. As an adult, I want to record an Expense in about three taps (open, type the amount and pick a Category, save), so that logging spending is effortless.
27. As an adult, I want my most recently used Categories shown first when recording, so that the usual choice is one tap away.
27a. As an adult, I want to type simple sums like `120+35` or `300÷3` on the amount keypad, so that I can add up a receipt or split a bill without leaving the app.
28. As an adult, I want the date to default to today and the note to be optional, so that I only fill in extras when I need them.
29. As an adult, I want to record an Expense with an earlier date, including in a previous Month, so that I can catch up on things I forgot.
30. As an adult, I want to record Income with an amount, a date and an optional note, so that Remaining reflects what actually came in.
31. As an adult, I want to edit or delete any Transaction, so that I can fix mistakes.
32. As an adult who records something just after midnight, I want it to count in the Month of my local date, so that time zones never move my spending into the wrong Month.

### Personal Budget: Categories and budgets

33. As an adult, I want to add, rename and reorder Categories, so that they match my life.
34. As an adult, I want to set a Category Budget for each Month, so that my plan can change from Month to Month.
35. As an adult, I want to change my Expected Income for a Month, so that a bonus or a lean Month is reflected.
36. As an adult, I want to archive a Category so it disappears from new Months but stays in my history, so that old Months still make sense.
37. As an adult, I want the Other Category to always exist, so that every Expense has somewhere to go.

### Kid Wallet: parent

38. As a parent, I want to create several Kid Profiles, so that each of my children has their own wallet.
39. As a parent, I want each Kid Wallet to start with Save, Spend and Give Jars, so that my child learns the habit of splitting money.
40. As a parent, I want to add, rename or archive Jars, so that I can adapt the wallet to my child.
41. As a parent, I want to add a Top-up whenever I like and split it across Jars, so that I decide how new money is divided.
42. As a parent, I want my last split remembered (or defaulting to all-Spend), so that topping up stays quick.
43. As a parent, I want to move money between Jars with a Jar Transfer, so that I can approve a child's request to use their savings.
44. As a parent, I want to edit or delete Top-ups, so that I can fix mistakes. My child can't change them.
45. As a parent, I want to review my child's Jars and full history, so that I know how they use their money.
46. As a parent, I want the Parent Area protected by a PIN or my device's biometrics, so that my child can't top themselves up.
46a. As a parent who just set a PIN, I want to be offered biometrics as an optional, skippable shortcut that I can change later in settings, so that opening the Parent Area is quick.
47. As a parent, I want to manage my kids' wallets fully offline from my own phone, so that a lack of signal never blocks a Top-up.
48. As a parent, I want to see when a Jar has gone below zero after sync, so that I can sort it out with my child.
49. As a parent who forgot the PIN, I want to reset it with an email code, so that I'm never locked out and my child can't reset it.
50. As a parent, I want to archive a Kid Profile, so that it disappears without losing its history.
51. As a parent, I want Top-ups to stay separate from my Personal Budget unless I log them myself, so that the two ledgers stay simple.

### Kid Wallet: child

52. As a child, I want to see how much money is in each of my Jars, so that I know what I can spend.
53. As a child, I want to record a Kid Expense from a Jar in about three taps, so that tracking feels easy.
54. As a child, I want to be told kindly when I don't have enough in a Jar, so that I learn to live within my money.
55. As a child, I want to edit or delete my own Kid Expenses, so that I can fix my mistakes.
56. As a child, I want my history to show Top-ups, Jar Transfers and my Kid Expenses, newest first, so that I can see money coming in as well as going out.
57. As a child, I want a Learn section with short lessons about saving, needs and wants, and giving, so that I understand why the Jars matter.
58. As a child, I want my screens to look friendlier than my parent's (bigger buttons, brighter colors), so that the app feels like mine.

### Kid-Mode device

59. As a parent, I want to set up my child's own phone by signing in with my email and choosing "This device is for a kid", so that my child never needs an account.
60. As a parent, I want a Kid-Mode device to show only one Kid Profile's wallet and Learn, so that my child can't see my budget.
61. As a parent, I want a Kid-Mode device to be technically unable to read my Personal Budget, even through the API, so that a curious child can't get around the screens.
62. As a parent, I want to enter my PIN on my child's device to reach the Parent Area while online, so that I can top up from their phone.
63. As a parent, I want to be told that the Parent Area on a kid's device needs internet, and to top up from my own phone instead, so that I know what to do offline.
64. As a parent, I want to list and revoke Kid-Mode devices, so that a lost phone stops having access.
65. As a parent, I want leaving Kid Mode to require my PIN, so that my child can't switch the device back to Personal.

### Offline and sync

66. As any user, I want every screen to work offline, so that the app is always usable.
67. As any user, I want my changes saved immediately and synced automatically when a connection returns, so that I never think about syncing.
68. As any user, I want to pull to refresh, so that I can force a sync.
69. As any user, I want a subtle indicator only when changes have waited too long to sync, so that I'm not nagged.
70. As an adult with two devices, I want edits made offline on both to merge, so that I don't lose Transactions.
71. As an adult, I want something I deleted to stay deleted even if an old device syncs later, so that deleted records don't reappear.
72. As an adult who opens a new Month on two offline devices, I want only one plan for that Month after sync, so that budgets aren't duplicated.
73. As an adult signing in on a new device, I want all my data downloaded, so that the device matches my others.

### Language and formatting

74. As an Arabic speaker, I want the whole app in Arabic with a right-to-left layout, so that it feels native.
75. As any user, I want to switch language in settings, with the app restarting if the direction changes, so that the layout is always correct.
76. As an Arabic speaker, I want to choose Western or Arabic-Indic digits, so that numbers look the way I'm used to.
77. As any user, I want amounts, dates and currencies formatted for my language, so that everything reads naturally.
78. As a family, I want each device to have its own language, so that a parent can use English while the child uses Arabic.
79. As an adult, I want to relabel my currency in settings without amounts being converted, so that I can fix a wrong choice.
80. As an Arabic-speaking adult, I want the sign-in code email in my language, so that I understand it.

## Implementation Decisions

### Architecture

- A monorepo using npm workspaces, with three parts: the mobile app, the API, and a shared package. The shared package holds domain types, sync payload types, money and date helpers, and pure domain logic, and must not depend on React Native or Node APIs.
- The API mirrors the a previous backend stack and conventions (ADR-0005): Express 4, Mongoose and express-validator. Requests flow routes → validation → controller → service → model. Responses use the `{ message, data, success }` envelope, errors are `AppError` subclasses caught by a central error handler, and email goes through a swappable mailer (Resend's HTTPS API in production, nodemailer to a local catcher in development; see ADR-0008). Deliberate differences from another project are listed in ADR-0005.
- The mobile app uses Expo with expo-router (separate route groups for authentication, onboarding, Personal, Kid and the PIN-gated Parent Area), expo-sqlite with Drizzle as the single source of truth for screens (ADR-0003), zustand for UI and session state only, axios for authentication and sync calls, NativeWind with start/end styling classes, i18next with expo-localization, SecureStore for tokens, and expo-local-authentication for biometrics.
- Hosting is fully separate from another project (ADR-0008): Railway Hobby runs the API, MongoDB Atlas M0 holds the data (with a nightly `mongodump`), and Resend sends email through its HTTPS API (Railway Hobby blocks outbound SMTP).
- Builds use EAS: a development client and a preview APK for Android, with over-the-air updates switched on. iOS is set up but not released.

### Domain rules

- Money is stored as integers in the currency's smallest unit (ADR-0004). There is one currency per Account, inherited by Kid Wallets, and changing it relabels amounts without converting them.
- A Month is a calendar month. Each Transaction carries a local calendar date, which decides its Month and is never converted between time zones, plus a separate edit time used for sync.
- Income, Spending, Remaining, Unallocated, per-Category figures and Jar balances are always worked out from Transactions, never stored or synced.
- A Month is created lazily, the first time it is opened or receives a Transaction, by copying the previous Month's Expected Income and Category Budgets.
- Every Expense has a Category. Other always exists and can't be archived. Archived Categories are hidden from new Months but kept in history. Income has no Category.
- Category Budgets can add up to any amount, so Unallocated may go negative.
- Adult amount keypads accept `+ − × ÷` with normal calculator order and no brackets. The expression is evaluated in whole minor units, rounded half-up, and only the result is stored. The child's keypad has no operators.
- A Kid Wallet is a running balance with no Months. A Top-up carries a split across Jars that must add up to its total. A Kid Expense comes out of exactly one Jar. A Jar Transfer moves an amount between two Jars of the same wallet and can only be made by a parent.
- The app blocks a Kid Expense larger than its Jar's balance. The server never rejects one, so a Jar can go negative after sync. The app then shows the negative balance, blocks further spending from that Jar, and flags it in the Parent Area.
- Adults can edit and delete anything. Kids can edit and delete only their own Kid Expenses.

### Data model

- Every synced record has a UUIDv7 ID created on the device (ADR-0006), its owning Account, the device's last-edit time, an optional deletion marker, and a server version number set by the server.
- Synced entities:
  - **Account settings:** currency, numbering system.
  - **Category:** name, order, Other flag, archived time.
  - **Month plan:** Month, Expected Income.
  - **Category Budget:** Month, Category, amount.
  - **Transaction:** income or expense, amount, Category for expenses, date, note.
  - **Kid Profile:** name, avatar, archived time.
  - **Jar:** Kid Profile, name, order, archived time.
  - **Kid Transaction:** Top-up with splits, Kid Expense with Jar and amount, or Jar Transfer with source Jar, target Jar and amount.
- Month plans and Category Budgets get deterministic IDs worked out from the Account and Month (and Category), so that two offline devices creating the same Month end up with one record. This rule was introduced after the design discussion.
- Server-only data:
  - **Accounts:** lowercased unique email, onboarding-completed time, hashed Parent PIN.
  - **Sessions:** hashed refresh token, scope (full or one Kid Profile), device label, expiry with automatic deletion, rotation family.
  - **One-time codes:** hashed, with separate counters for codes sent and wrong guesses, deleted automatically.
  - **A counter** for server version numbers.
- Language is per device and never synced.

### Authentication and authorization

- Requesting a code and verifying it are the only steps. Verifying creates the Account if needed and returns tokens plus a new-Account flag. There is no separate registration step.
- Codes are 6 digits, expire after 10 minutes, are stored hashed, allow up to 5 wrong guesses, and can be resent once a minute and five times an hour. Rate limits apply per IP and per email, and there is no hard-coded test code.
- Access tokens last 15 minutes and refresh tokens 90 days. They use separate secrets and carry a type marker. Each refresh issues a new token atomically, and reusing an old refresh token revokes the whole session.
- Environment variables are checked when the server starts.
- Session scopes:
  - **Full:** the whole Account.
  - **Kid:** one Kid Profile. It can read that wallet and write only Kid Expenses (ADR-0002).
- PIN elevation sends the Parent PIN to the server, which checks it with rate limiting and returns a short-lived full access token with no refresh. That's why the Parent Area on a Kid-Mode device needs internet.
- Setting up a Kid-Mode device swaps the full session for a Kid session, and the full tokens are deleted from that device.
- A forgotten PIN is reset with an email code.
- Deleting an Account requires an email code. It hard-deletes every collection and revokes all sessions.

### API contract

- Authentication: request code, verify code, refresh, logout.
- Sync: a single push-then-pull endpoint (ADR-0007). It accepts a cursor and a list of changes, and returns the changes after that cursor plus a new cursor.
  - Conflicts are resolved by last edit wins, per record (ADR-0001), and deletion markers are kept.
  - Results are filtered by session scope.
  - Changes are validated: allowed by scope, references belonging to the same Account, positive whole-number amounts, and Top-up splits adding up to the total.
- Account: set or change the PIN, reset the PIN with a code, mark onboarding complete, delete the Account.
- Kid devices: create a Kid session, elevate with the PIN, list Kid-Mode devices, revoke one.

### Mobile sync engine

- Every local write updates the local table and adds an entry to an outbox in the same transaction.
- The engine sends the outbox, applies pulled changes by last edit wins, and saves the cursor.
- It runs after local writes (debounced about 2 seconds), when the app comes to the foreground, when the connection returns, and on pull-to-refresh. There is no background sync.
- Screens read only through live queries on the local database.

### Localization

- English and Arabic are both present in every milestone. Switching direction shows a notice and restarts the app.
- All layout uses start/end, and direction-sensitive icons are mirrored.
- Numbers, dates and currency are formatted with the platform's `Intl` APIs, using the chosen numbering system, with Western digits by default.
- Learn lessons ship with the app in both languages.

### Delivery order

1. **Foundations:** monorepo, tooling and CI, shared helpers, API skeleton, Expo shell with i18n and right-to-left support, hosting.
2. **Authentication.**
3. **Local store and sync engine.**
4. **Personal Budget.**
5. **Kid Wallet** from the parent's device.
6. **Kid-Mode device.**
7. **Learn.**
8. **Settings, Account deletion and the tester release.**

## Testing Decisions

- Good tests check external behavior through the highest available seam: HTTP responses, synced end states and computed figures, never internal calls or private functions. Tests should keep passing through refactors that don't change behavior.
- **Seam A, API over HTTP.** Requests go to the real Express app backed by an in-memory MongoDB (mongodb-memory-server). Covers:
  - code request and verify, including limits and expiry;
  - token refresh, rotation and revocation when an old token is reused;
  - logout;
  - sync push and pull, cursor behavior and deletion markers;
  - scope enforcement, especially that a Kid session can't read Personal data or write Top-ups or Jar Transfers;
  - PIN elevation and its rate limit;
  - PIN reset;
  - Kid device revocation;
  - Account deletion removing every collection.
- **Seam B, sync client to API.** The mobile sync engine runs in Node against an SQLite driver (better-sqlite3 with Drizzle) and talks to the API in the same process. Several simulated devices edit offline and sync in different orders. Covers:
  - devices ending up with the same data;
  - the last edit winning;
  - deletions surviving an old copy syncing back;
  - no duplicate Months;
  - Jar balances going negative after a conflicting sync;
  - a Kid device only ever holding its Kid Profile's records.

  This seam is the main proof that offline sync works.
- **Seam C, shared domain functions.** Plain unit tests cover:
  - Income, Spending, Remaining and Unallocated;
  - per-Category spent and remaining;
  - Jar balances;
  - Month calculation from local dates, including around midnight and month ends;
  - creating a new Month by copying the previous one;
  - money conversion to and from the smallest unit, and formatting in both locales and both numbering systems;
  - Top-up split validation;
  - keypad expression evaluation (operator order, rounding, incomplete expressions, division by zero).
- Mobile screens are tested by hand in the MVP, including a right-to-left visual pass. Automated UI tests are out of scope.
- **Prior art:** a previous backend uses Jest with ts-jest, which we follow. It only has unit tests without a database, so seams A and B go beyond it on purpose.

## Out of Scope

Recurring top-ups or allowances, recurring expenses, notifications, any charts or reports (the category breakdown is a list), receipts or photos, several currencies per Account, payday-based Months, carry-over, Learn progress tracking, kid-requested Jar Transfers, analytics, data export, web app, iOS release, Google/Apple/guest login, background sync, linking Top-ups to the parent's Personal Budget, automated mobile UI tests, any account or infrastructure shared with another project, income categories, expense templates, savings goals (Jar or personal), an app lock, gold (XAU) as a currency, an AI assistant, and any premium tier or billing. The order of post-MVP work is in the MVP scope note.

## Further Notes

- The vocabulary is in the glossary, the decisions in ADRs 0001–0008, and the scope boundary in the MVP scope note.
- Still open, none of it blocking: branding (name, logo, colors), Learn lesson text in English and Arabic, and the privacy policy and terms needed for Play Store submission.
- If Atlas M0 limits or the absence of backups become a problem, move to Atlas M10.
