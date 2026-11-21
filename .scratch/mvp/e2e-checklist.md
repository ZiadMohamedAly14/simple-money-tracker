# MVP end-to-end checklist (ticket 19)

A script to run by hand on real phones before testers get the APK. Each step says what to do and what you should see. Tick the box when it matches; when it doesn't, write what happened under the step.

## Before you start

- **Phones:**
  - **A**, your phone: personal use, the parent.
  - **B**, a second phone signed in to the same Account.
  - **K**, the kid's phone, set up in Kid Mode.
- **Build:** the preview APK from EAS on all three phones, pointing at the Railway API.
- **Email:** an inbox you can open on another device, for the sign-in codes.
- **Two runs:**
  1. Go through every section in **English**, light mode.
  2. Go through it again in **Arabic**, dark mode, with **Arabic-Indic digits** turned on in Settings.

  Start the second run with a fresh Account, or delete the first one (section 11).
- **Offline:** "Offline" means airplane mode. Turn it back on only when a step says so.

## 1. Sign in and onboarding (phone A)

- [ ] Open the app. The splash shows with no white flash, then the sign-in screen.
- [ ] Enter your email. A code arrives by email, and the code screen shows your email the right way round (also in Arabic).
- [ ] A wrong code shows an error. The right code goes on to "Who is it for?".
- [ ] Choose the personal path:
  - pick a currency;
  - enter an Expected Income, e.g. 8,000;
  - split it across the default Categories (Food & groceries, Bills & utilities, Shopping, Other).
- [ ] Home shows the hero card:
  - Remaining 8,000;
  - "0 of 8,000 expected" under the bar;
  - Income 0 and Spending 0;
  - Unallocated as you left it.
- [ ] Each info icon (Income, Spending, Unallocated) opens the app's own dialog, not the plain Android one, with a short explanation and OK.

## 2. Expenses and Income (phone A, online)

- [ ] Tap **+**, type 120, pick Food & groceries, then Save. Spending and Remaining update, and the Food row shows 120 spent.
- [ ] Tap the **Bills & utilities row** on home. Add expense opens with Bills & utilities already selected. Save 300.
- [ ] Type a sum on the keypad (e.g. 50+25). It saves 75.
- [ ] **Add income** 2,000 with a note. Income shows 2,000 and the bar fills a quarter.
- [ ] Add income until it's above 8,000 (e.g. another 6,500). Remaining now counts the Income, so it isn't negative when you've spent less than you received.
- [ ] Open Transactions:
  - edit an Expense's amount and date;
  - delete one from its edit screen, after the confirm dialog.

  The totals follow each change.
- [ ] Pick a date in the date field: the calendar opens, and the arrows and weekday order are correct.

## 3. Categories and budgets (phone A)

- [ ] Categories → add "Rent". The icon changes to a house as you type. Pick a different icon: it stays when you rename.
- [ ] Set Rent's budget. Unallocated goes down by that amount.
- [ ] Archive a Category. It moves to the Archived section and stops showing on home.
- [ ] Delete a Category that has Expenses:
  - the dialog gives the Expense count, the budget line and "can't be undone", with Archive instead and Delete;
  - after Delete, its Expenses show under Other and Spending doesn't change.
- [ ] Try to delete or archive the last Category besides Other. Both buttons are disabled, with a reason.

## 4. Months (phone A)

- [ ] Go back a Month with the arrow. It shows that Month's plan and Transactions. Forward stops at the current Month.
- [ ] Add an Expense while viewing a past Month. Its date starts on that Month's last day.

## 5. Sync between two phones (A and B)

- [ ] On B, sign in with the same email.
  - B shows "Whose phone is this?" only if you already set a Parent PIN; choose **My phone**.
  - B shows the same Months, Categories and Transactions as A.
- [ ] On A, add an Expense. Within a few seconds (or after pull to refresh) B shows it.
- [ ] Put **B offline**:
  - add two Expenses and edit one old one;
  - after a minute, "Pending sync" shows with its icon;
  - turn B back on: the label goes away and A gets all three changes.
- [ ] **Conflict:** put both phones offline.
  1. Edit the same Expense to different amounts, A first, then B.
  2. Turn both back on.

  Both end up with B's amount (the later edit).
- [ ] **Delete vs. edit:** offline, delete an Expense on A and edit it on B. After both sync, it's gone on both.
- [ ] **Category delete vs. offline Expense:**
  1. With B offline, record an Expense into Shopping on B.
  2. Delete Shopping on A.
  3. Turn B back on.

  Both phones show that Expense under Other, with the same totals.

## 6. Parent PIN and Kid Wallet (phone A)

- [ ] Open the Parent Area. It asks you to set a Parent PIN; set it.
- [ ] Add a kid, e.g. "Omar":
  - the letter avatar "O" updates as you type;
  - there are no emoji choices;
  - Omar gets Save, Spend and Give Jars.
- [ ] Top-up 100 split across the Jars. Percentages show, and the amounts always add up to 100.
- [ ] Make a Jar Transfer from Save to Spend. Both balances change.
- [ ] Open Omar's history. It reads "Top-up +100" and "10 moved to Spend", never "You moved".
- [ ] Leave the Parent Area, then reopen it. It asks for the PIN again. A wrong PIN is refused.

## 7. Kid-Mode phone (phone K)

- [ ] On K, sign in with the parent's email.
  1. At "Whose phone is this?", choose **My kid's phone**.
  2. Enter the Parent PIN once.
  3. Pick Omar.
- [ ] K shows only Omar's wallet: Mint background (Teal in dark mode), Jar circles and balances, the "I spent money" button and Today's lesson. There's no way to reach the parent's budget, even with the back button.
- [ ] Record a Kid Expense from Spend. On A, Omar's Spend balance goes down.
- [ ] Try to spend more than a Jar holds. A kind "not enough" message tells you to ask your parent.
- [ ] Put K offline and record a Kid Expense. Turn it back on, and A gets it.
- [ ] Open **Today's lesson**:
  - one lesson card with its drawing;
  - "Come back tomorrow for a new lesson." under it;
  - in dark mode the drawing is the dark version.
- [ ] On A, add a Top-up. K shows it after a refresh.

## 8. Parent access on the kid's phone (phone K)

- [ ] On K, open the Parent Area. It asks for the Parent PIN and needs internet. Offline, it shows "needs internet".
- [ ] With the PIN, you can top up and transfer between Jars from K.
- [ ] Wait 15 minutes, or lock it. It asks for the PIN again.
- [ ] **Leave Kid Mode** (Parent Area → leave → confirm). K goes straight to the sign-in screen with no error.
- [ ] Set K up in Kid Mode again for the next step.

## 9. Kid devices (phone A)

- [ ] Parent Area → Kid devices lists K. Pull to refresh works.
- [ ] Remove K. The next time K syncs, it's signed out and Omar's data is gone from K.

## 10. Settings (phone A)

- [ ] **Language:** switch to Arabic. The app asks to restart. After it restarts:
  - everything mirrors: back arrows point right, bars fill from the right, chips start on the right;
  - amounts, emails and "spent / budget" stay readable.
- [ ] **Digits:** switch to Arabic-Indic. Every amount and count uses ٠١٢٣.
- [ ] **Appearance:** System, Light and Dark each switch at once with no restart.
  - The status bar and navigation bar follow the choice.
  - Cards are still visible against the background in dark mode.
- [ ] **Currency:** change it. Amounts show the new code.
- [ ] Change the Parent PIN. A PIN reset by email code works.
- [ ] **Sign out:** the red button, after a confirm. The phone goes to sign-in, and signing back in brings the data back from the server.

## 11. Archiving a kid and deleting the Account

- [ ] Archive Omar (Parent Area → Omar → archive). He moves to the archived list, and K can no longer use him.
- [ ] **Delete account** (Settings, with a code by email):
  - A goes to sign-in, and the data is gone;
  - B and K are wiped the next time they sync.

## 12. Over-the-air update (once)

- [ ] Publish a small text change: `eas update --channel preview --message "test"`. Close and reopen the app twice on A, and the change shows. Then revert it.

## Accessibility spot checks (both runs)

- [ ] Turn on TalkBack. On home it reads "Remaining, 1,870.00 EGP" style labels, and icon-only buttons (settings, back, edit, info, delete) have names.
- [ ] Small icons (info, chevrons, Archived delete) are easy to hit with a thumb.
- [ ] With the phone's font size at its largest, home, Add expense and the kid wallet still fit without cut-off amounts.

## Arabic by-eye checks (second run)

These come from the code pass; only a person looking at the screen can judge them.

- [ ] **Signs:** minus and plus signs sit before the number on the hero card, Unallocated, Transactions and kid history.
- [ ] **Captions:** "spent / budget" captions read correctly.
- [ ] **Emails:** they show the right way round on the code, PIN-reset and delete-account screens.
- [ ] **Top-up split:** the lines show "٪ · amount" correctly.
- [ ] **Arrows:** back and chevron arrows mirror; the previous-month arrow points right.
- [ ] **Long names:** long Category and Jar names truncate cleanly in chips and rows.
- [ ] **Home header:** it isn't crowded when "Pending sync" shows.
- [ ] **Learn:** the card scrolls on a small phone and nothing is cut off.
- [ ] **Calendar:** it starts on Saturday.
- [ ] **TalkBack:** walk through the home and Categories rows. Each reads its name and amounts, then what tapping does.

## Result

| Run | Date | Phones | Passed | Problems found |
|---|---|---|---|---|
| English, light | | | | |
| Arabic, dark, Arabic-Indic digits | | | | |
