# 13: Kid Expenses, Jar Transfers and history

**What to build:** A child records a Kid Expense from a Jar in about three taps and sees their full history. A parent moves money between Jars, and negative Jars after a sync are handled gracefully.

**Blocked by:** 12 (Kid Profiles, Jars and Top-ups).

**Status:** ready-for-agent

- [x] Three-tap Kid Expense with Jar chips. It's blocked with a kind, bilingual message when the Jar can't cover it.
- [x] Kids can edit and delete their own Kid Expenses.
- [x] The parent can make a Jar Transfer from the Parent Area.
- [x] History lists Top-ups, Jar Transfers and Kid Expenses, newest first.
- [x] A Jar that goes negative after a sync shows its balance, blocks further spending from it, and is flagged in the Parent Area. A Seam B scenario covers this.

## Comments

Built on `ticket/13-kid-expenses-transfers-history`:

- **Shared (Seam C):** `KID_TRANSACTION_KINDS` = `topUp`, `kidExpense`, `jarTransfer`. `KidTransactionFields` gains `jarId` (a Kid Expense's Jar, or a Jar Transfer's source) and `toJarId` (a Jar Transfer's target). Both are null for a Top-up, and `splits` is empty for the other kinds. The parser reads only the fields a kind uses and drops the rest, and it refuses a Jar Transfer to the same Jar. `jarBalances` subtracts Kid Expenses and moves Jar Transfers. Balances can go negative. `spendableFrom(balances, jarId, editing?)` is the most a Kid Expense or Jar Transfer can take: never below 0, and an edit gets back the amount it already took from the same Jar. `negativeJarIds` lists Jars below zero.
- **API (Seam A, `test/kidWallet.test.ts`):** the model enum and `jarId`/`toJarId` (default null). `checkWallets` now checks every Jar a Kid Transaction names: split Jars, `jarId` and `toJarId`. It reports the field that names a wrong Jar. The server never rejects an overspend (spec). Kid Sessions still can't write anything (ticket 14 opens Kid Expenses for them).
- **Mobile data (Seam B, `src/sync/kidExpenses.seamB.test.ts`):** local migration 4 (`jar_id`, `to_jar_id` on `kid_transactions`). `addKidExpense`/`editKidExpense`/`deleteKidExpense` return `not_enough` with `available` and save nothing when the Jar can't cover the amount or is below zero. Editing or deleting anything other than a Kid Expense is refused (`not_a_kid_expense` / false), so the kid-facing calls can't touch Top-ups or Jar Transfers. `addJarTransfer`/`editJarTransfer`/`deleteJarTransfer` refuse moving more than the source Jar holds, and moving into the same Jar. `Wallet.negativeJarIds`. The history is `kidTransactionsQuery`: newest date first, then newest created (UUIDv7). The tests cover: offline expenses syncing; the block; editing (including into another Jar) and deleting; kid-only rules; transfers (add, edit, delete); history order on both devices; and two offline devices both spending 40 of 50, so Spend is −30 on both. Further spending from Spend is blocked while other Jars still work, and a Jar Transfer plus a Top-up clear the flag.
- **Screens:** `kid/[id]` is the kid's wallet in the Kid theme: "Hi {name}", "In my wallet", Jars with negative balances in red, a notice for each Jar below zero, the dark "I spent money" button, My history and Learn. `kid/[id]/spend` is "I spent money": a digits-only keypad with no operators, Jar chips with Spend preselected, so open → amount → Save is three taps, and an optional note. When the Jar can't cover the amount, or is below zero, it shows a kind notice (`app:gentle-warning`) and Save stays off. With `expenseId` it edits or deletes. `kid/[id]/history` is "My history": rows grouped by day, with "Your parent added 50" and neutral "10 moved to Save" wording (design flaw 4). Only Kid Expenses open. `parent/kids/[id]/move` is Move money: 08's `useAmountEntry`/`AmountKeypad` (sums allowed), From chips showing balances, and To chips. With `transferId` it edits or deletes. `parent/kids/[id]/history` is Full history, where every row opens its edit screen. The parent's wallet screen (`parent/kids/[id]`) now has Move money, Full history, a below-zero notice, and "Open {name}'s screens". The inline Top-ups list is gone; Top-ups open from Full history. The Parent Area kid card shows the below-zero notice too. Icons used: `app:shopping-spend`, `app:move-money`, `app:reorder-history`, `app:gentle-warning`, `app:income-money`, `app:jar-save`/`gift-give` per Jar, `app:kids`, `app:learn`, `app:delete`. Strings are EN and AR under `kid.home`, `kid.spend`, `kid.move` and `kid.history`, plus new `kid.wallet` keys.

**Left over / notes:**
- The kid's screens live at `/kid/[id]` outside the Parent PIN gate. For now a parent reaches them from the kid's wallet in the Parent Area. Ticket 14 should make `/kid/[id]` the Kid-Mode home, drop the back button there, and let a Kid Session write Kid Expenses (`kidCanWrite`/`kidCanRead` for `kidTransaction`, Kid Expenses only).
- A parent editing a Kid Expense from Full history uses the kid's "I spent money" screen, in the Kid theme.
- A Jar Transfer can empty an archived Jar that still holds money, but can't move money into one. Kid Expenses and Jar Transfers are dated today; the data layer accepts other dates.
- Reducing a Jar Transfer, or moving its target, can take the old target Jar below zero if that money was already spent. Only the source Jar is checked.
- The API passes pre-ticket-13 Top-ups back without `jarId`/`toJarId` (lean reads skip defaults). The device stores them as null.

**Human follow-up:**
- Deploy the API (new kinds and the Jar checks on `/sync`). An older build's `jarBalances` counts only Top-ups, so it would show wrong balances once Kid Expenses or Jar Transfers sync to it. Ship the app update together with the API.
- No new native modules.
- Manual device check in English and Arabic (RTL): record a Kid Expense in three taps; try more than Spend holds and read the notice; edit and delete one from My history; Move money with a sum like `10+5`; Full history order and opening each kind; two phones offline both spending most of Spend, then sync, and check the red balance, the blocked chip, and the notice in the Parent Area and on the kid's wallet.
