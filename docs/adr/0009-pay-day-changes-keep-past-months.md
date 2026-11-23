---
status: accepted
---

# Changing Pay Day never redraws past Months

A Month runs from one Pay Day to the day before the next. When the adult changes Pay Day, Months that have already started keep their dates, and only later Months use the new Pay Day. So the Account keeps a history of Pay Day changes, not just the current value, and finding which Month a date belongs to has to read that history. We chose this over the simpler option of storing only the current Pay Day and redrawing every Month with it: redrawing would move old Transactions into different Months and silently change old Remaining figures the adult has already reviewed.

## The changeover

The adult picks one of two options when changing Pay Day:

- **Start after this Month** (the default, always offered). The current Month keeps its end date. The next Month is a Bridge Month: it starts the day after and ends the day before the first new Pay Day that starts the Month after it.
- **Start now** (offered only when it skips no Month name, which in practice means early in the Month). The current Month keeps its start date and ends the day before the first new Pay Day after today that starts a differently named Month.

Both rules keep Month names unique and consecutive: no Month is named twice or skipped. Expected Income and Category Budgets are never scaled to the changed length. A second change before a pending one takes effect replaces it (last edit wins, as with all synced records).

## Considered Options

- **Store only the current Pay Day and redraw all Months.** One number, and a simple date-to-Month lookup. Rejected because past Months would change after the fact.
- **Store a start date on every Month.** Rejected because Months are created lazily on each device, and two offline devices could disagree on where a Month starts. A synced Pay Day history gives every device the same boundaries.
- **Always apply the change immediately.** Rejected because a change late in the Month skips a Month name (Pay Day 1 → 20 on 25 Nov makes the next Month "January", so "December" never exists), and because it changes a Month the adult is in the middle of.

## Consequences

- Each history entry needs only the new Pay Day and the date the first Month on it starts. The Month before that date ends the day before it. An Account with no entries has Pay Day 1, so existing data needs no migration.
- The Month key stays `YYYY-MM`. It is the Month's name (the start month for Pay Day 1–15, the next month for Pay Day 16–31, the next name in sequence for a Bridge Month), not the calendar month of its dates. `monthOf(date)` is no longer `date.slice(0, 7)`, and the `LIKE 'YYYY-MM-%'` queries become date-range queries.
- The naming rule is fixed per Pay Day, not "the calendar month holding most days": with Pay Day 16 the majority rule names 16 Jan – 15 Feb "January" and 16 Feb – 15 Mar "March", skipping February.
