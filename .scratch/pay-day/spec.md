# Pay Day: Months that start when the adult gets paid

Decided in a grilling session on 2026-11-23. Terms: **Month**, **Pay Day** and **Bridge Month** in `GLOSSARY.md`. The design for Pay Day changes is ADR-0009.

## Problem

Most salaried adults are paid near the end of the month, and that salary funds the next month. With calendar Months, the salary on the 26th lands in a Month that is almost over. Remaining looks huge for 5 days, and then the new Month starts at 0 with the money already spent.

## Decisions

1. **In the MVP.** Payday-based Months move from Out to In. Carry-over stays Out, and Kid Wallets are not affected.
2. **One Pay Day per Account**, default 1. Choices are days 1–31; 31 is shown as **Last day of the month**. In a month too short for the chosen day, the Month starts on that month's last day. An early or late salary does not move Pay Day: the Income is dated the day it arrived. Advice in the picker: choose the earliest day you usually get paid.
3. **Boundaries.** A Month runs from one Pay Day to the day before the next. Pay Day 1 gives calendar months, so existing behaviour is unchanged.
4. **Naming.** Pay Day 1–15 → named after the calendar month it starts in. Pay Day 16–31 → named after the next calendar month. The name is the `YYYY-MM` key. The date range shows under the name on the Month screen. (A "most days" rule was rejected: with Pay Day 16 it skips February.)
5. **Setup.** One optional first-run step, "When do you get paid?", defaulting to 1st / not sure. The first Month is simply the current Month under the chosen Pay Day, even if only a few days are left. Accounts that have already finished setup don't see the step; they use Settings.
6. **Settings.** Pay Day can be changed at any time. Before saving, the app previews the dates of the current and next Months for each option.
7. **Changing Pay Day never redraws Months that have already started** (ADR-0009). Two options:
   - **Start after this Month** (always offered, preselected). The current Month keeps its end date. The next Month is a **Bridge Month**: named with the next name in sequence, starting the day after, and ending the day before the first new Pay Day that starts a Month with the name after that.
   - **Start now** (offered only when it skips no Month name). The current Month keeps its start date and name, and ends the day before the first new Pay Day **after today** that starts a Month with a different name.
   No Month name is ever repeated or skipped.
8. **Pending change.** Until a "Start after this Month" change takes effect, Settings shows "Pay Day: 1st → 25th from 1 Dec". A second change before then replaces the pending one (last edit wins).
9. **Budgets are never scaled.** A shortened, stretched or Bridge Month copies Expected Income and Category Budgets from the previous Month as usual. The adult edits them if needed.

## Worked examples (test cases)

Boundaries and names:

| Pay Day | Date | Month name | Month dates |
|---|---|---|---|
| 1 | 23 Nov | November | 1 Nov – 30 Nov |
| 5 | 23 Nov | November | 5 Nov – 4 Dec |
| 15 | 10 Nov | October | 15 Oct – 14 Nov |
| 16 | 23 Nov | December | 16 Nov – 15 Dec |
| 26 | 23 Nov | November | 26 Oct – 25 Nov |
| 26 | 26 Nov | December | 26 Nov – 25 Dec |
| 28 | 23 Nov | November | 28 Oct – 27 Nov |
| 31 | 15 Mar 2027 | March | 28 Feb – 30 Mar |
| 31 / Last day | 20 Apr 2027 | April | 31 Mar – 29 Apr |
| 16 | 20 Feb 2027 | March | 16 Feb – 15 Mar (February is 16 Jan – 15 Feb) |

Pay Day 31 clamped to short months is exactly "Last day of the month": Months start 31 Jan, 28 Feb, 31 Mar and 30 Apr. "Last day" is a friendlier label for 31, not a separate rule.

Changing Pay Day:

| Change | Today | Start now | Start after this Month |
|---|---|---|---|
| 1 → 25 | 10 Nov | November 1–24 Nov; December from 25 Nov | November 1–30 Nov; December (Bridge) 1–24 Dec; January from 25 Dec |
| 1 → 26 | 23 Nov | November 1–25 Nov; December from 26 Nov | November 1–30 Nov; December (Bridge) 1–25 Dec; January from 26 Dec |
| 1 → 20 | 25 Nov | not offered (skips December) | November 1–30 Nov; December (Bridge) 1–19 Dec; January from 20 Dec |
| 25 → 10 | 30 Nov | December 25 Nov – 9 Jan; January from 10 Jan | December 25 Nov – 24 Dec; January (Bridge) 25 Dec – 9 Feb; February from 10 Feb |

## Out of scope

Carry-over, a different Pay Day per Month, scaling budgets, and reminders on Pay Day.
