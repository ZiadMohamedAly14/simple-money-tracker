# 01: Month boundaries and names from a Pay Day history

**Status:** ready-for-agent

**What to build:** Pure functions in `packages/shared/src/dates/` that take the Account's Pay Day history (empty means Pay Day 1):
- the date range of a Month key,
- the Month a local date belongs to (replacing `monthOf(date) = date.slice(0, 7)`),
- the current Month, and stepping to the previous and next Month,
- the two changeover options for a new Pay Day on a given day: whether **Start now** is allowed, and the resulting boundaries for each option.

Follow spec decisions 2–4 and 7: days 29–31 clamp to the last day of the month (31 is "Last day"), and the naming rule is fixed per Pay Day.

**Acceptance:** Every row in both worked-example tables in `../spec.md` passes as a unit test. All existing `month.test.ts` cases still pass with an empty history. Over 24 months, no Pay Day from 1 to 31 ever repeats or skips a Month name.
