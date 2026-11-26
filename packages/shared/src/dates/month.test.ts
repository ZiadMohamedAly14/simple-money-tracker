import {
  addMonths,
  currentMonth,
  formatDayMonth,
  formatMonth,
  monthDates,
  monthOf,
  cancelPendingPayDay,
  payDayOptions,
  payDayState,
  setupPayDayHistory,
  type Month,
  type PayDayHistory,
} from './month';

/** A history whose one Pay Day has been in force since long before the dates under test. */
const since = (payDay: number): PayDayHistory => [{ payDay, startsOn: `2020-01-${String(payDay).padStart(2, '0')}` }];

const nextDay = (date: string): string => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

/**
 * Walks `days` days from `from`: each day is in the same Month as the day
 * before or the next one by name, and every Month's dates are exactly the days
 * that fall in it.
 */
function expectConsecutiveMonths(history: PayDayHistory, from: string, days: number): void {
  // Collects the first problem and asserts once: an expect per day is too slow for the sweeps.
  let problem: string | null = null;
  let date = from;
  let month = monthOf(date, history);
  if (monthDates(month, history).start > date) problem = `${month} starts after ${date}`;
  for (let i = 0; i < days && !problem; i++) {
    const next = nextDay(date);
    const nextMonth = monthOf(next, history);
    const dates = monthDates(month, history);
    if (nextMonth === month) {
      if (dates.end <= date) problem = `${month} ends ${dates.end} but ${next} is in it`;
    } else if (nextMonth !== addMonths(month, 1)) {
      problem = `${nextMonth} follows ${month} on ${next}`;
    } else if (dates.end !== date || monthDates(nextMonth, history).start !== next) {
      problem = `${month} ends ${dates.end}, ${nextMonth} starts ${monthDates(nextMonth, history).start}, but the change is on ${next}`;
    }
    date = next;
    month = nextMonth;
  }
  expect({ history, problem }).toEqual({ history, problem: null });
}

/**
 * A cheaper check than walking every day, for sweeps: `count` Months from
 * `first` follow on with no gap or overlap, and each one's first and last day
 * fall in it.
 */
function expectContiguousMonths(history: PayDayHistory, first: Month, count: number): void {
  const problems: string[] = [];
  for (let i = 0, month = first; i < count; i++, month = addMonths(month, 1)) {
    const { start, end } = monthDates(month, history);
    if (start > end) problems.push(`${month} ends ${end} before it starts ${start}`);
    if (monthOf(start, history) !== month || monthOf(end, history) !== month) problems.push(`${month} (${start} – ${end}) is not where its own days fall`);
    if (nextDay(end) !== monthDates(addMonths(month, 1), history).start) problems.push(`${month} ends ${end} but the next Month does not start the day after`);
  }
  expect({ history, problems }).toEqual({ history, problems: [] });
}

describe('monthOf with a Pay Day', () => {
  it('names a Month after the calendar month it starts in for Pay Day 1–15', () => {
    expect(monthOf('2026-11-23', since(5))).toBe('2026-11');
    expect(monthOf('2026-11-10', since(15))).toBe('2026-10');
  });
});

const WORKED_EXAMPLES: [number, string, Month, string, string][] = [
  // Pay Day, date, Month name, first day, last day
  [1, '2026-11-23', '2026-11', '2026-11-01', '2026-11-30'],
  [5, '2026-11-23', '2026-11', '2026-11-05', '2026-12-04'],
  [15, '2026-11-10', '2026-10', '2026-10-15', '2026-11-14'],
  [16, '2026-11-23', '2026-12', '2026-11-16', '2026-12-15'],
  [26, '2026-11-23', '2026-11', '2026-10-26', '2026-11-25'],
  [26, '2026-11-26', '2026-12', '2026-11-26', '2026-12-25'],
  [28, '2026-11-23', '2026-11', '2026-10-28', '2026-11-27'],
  [31, '2027-03-15', '2027-03', '2027-02-28', '2027-03-30'],
  // The spec table names this "May", but that contradicts its own row above
  // (28 Feb – 30 Mar is March) and would skip April; decision 4 makes it April.
  [31, '2027-04-20', '2027-04', '2027-03-31', '2027-04-29'],
  [16, '2027-02-20', '2027-03', '2027-02-16', '2027-03-15'],
  [16, '2027-02-15', '2027-02', '2027-01-16', '2027-02-15'],
];

describe('Month boundaries and names (spec worked examples)', () => {
  it.each(WORKED_EXAMPLES)('Pay Day %i: %s is in %s, %s – %s', (payDay, date, month, start, end) => {
    expect(monthOf(date, since(payDay))).toBe(month);
    expect(monthDates(month, since(payDay))).toEqual({ start, end });
  });

  it('Pay Day 31 is the last day of each month', () => {
    const starts = ['2027-02', '2027-03', '2027-04', '2027-05'].map((month) => monthDates(month, since(31)).start);
    expect(starts).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
  });

  it.each(Array.from({ length: 31 }, (_, i) => i + 1))('Pay Day %i never repeats or skips a Month name over 24 months', (payDay) => {
    expectConsecutiveMonths(since(payDay), '2026-01-01', 24 * 31);
  });

  it('an empty history is calendar months', () => {
    expect(monthDates('2024-02', [])).toEqual({ start: '2024-02-01', end: '2024-02-29' });
    expect(monthDates('2026-12', [])).toEqual({ start: '2026-12-01', end: '2026-12-31' });
  });
});

describe('setupPayDayHistory: the Pay Day picked while setting up (spec decision 5)', () => {
  it.each(WORKED_EXAMPLES)('Pay Day %i on %s: the first Month is %s, %s – %s', (payDay, today, month, start, end) => {
    const history = setupPayDayHistory(payDay, today);
    expect(monthOf(today, history)).toBe(month);
    expect(monthDates(month, history)).toEqual({ start, end });
  });

  it('1st / not sure needs no entry: calendar Months', () => {
    expect(setupPayDayHistory(1, '2026-11-23')).toEqual([]);
  });

  it('records one entry starting on the first Month, however few days are left', () => {
    expect(setupPayDayHistory(26, '2026-11-23')).toEqual([{ payDay: 26, startsOn: '2026-10-26' }]);
  });
});

describe('addMonths', () => {
  it('steps to the previous and next Month, across year ends', () => {
    expect(addMonths('2026-03', -1)).toBe('2026-02');
    expect(addMonths('2026-03', 1)).toBe('2026-04');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-11', -23)).toBe('2024-12');
    expect(addMonths('2026-11', 0)).toBe('2026-11');
  });
});

describe('formatMonth', () => {
  it('names the Month and year in the language', () => {
    expect(formatMonth('2026-11', { language: 'en' })).toBe('November 2026');
    expect(formatMonth('2026-01', { language: 'en' })).toBe('January 2026');
  });

  it('uses Arabic month names, with Western digits unless Arabic-Indic are chosen', () => {
    expect(formatMonth('2026-11', { language: 'ar' })).toBe('نوفمبر 2026');
    expect(formatMonth('2026-11', { language: 'ar', numberingSystem: 'arabic-indic' })).toBe('نوفمبر ٢٠٢٦');
  });

  it('is not moved into a neighbouring Month by the time zone', () => {
    // The suite runs at UTC+14; midnight UTC on the 1st is still the same Month.
    expect(formatMonth('2026-12', { language: 'en' })).toBe('December 2026');
  });

  it('can leave the year out, for lists of nearby Months', () => {
    expect(formatMonth('2026-11', { language: 'en', year: false })).toBe('November');
    expect(formatMonth('2026-11', { language: 'ar', year: false })).toBe('نوفمبر');
  });
});

describe('formatDayMonth', () => {
  it('writes the day first in English, "1 Dec" (spec decision 8)', () => {
    expect(formatDayMonth('2026-12-01', { language: 'en' })).toBe('1 Dec');
    expect(formatDayMonth('2027-01-25', { language: 'en' })).toBe('25 Jan');
  });

  it('uses Arabic month names and the chosen digits', () => {
    expect(formatDayMonth('2026-12-01', { language: 'ar' })).toBe('1 ديسمبر');
    expect(formatDayMonth('2026-12-01', { language: 'ar', numberingSystem: 'arabic-indic' })).toBe('١ ديسمبر');
  });

  it('is not moved to a neighbouring day by the time zone', () => {
    expect(formatDayMonth('2026-12-31', { language: 'en' })).toBe('31 Dec');
  });
});

// jest.config.js runs this suite at UTC+14 (Pacific/Kiritimati).

describe('monthOf', () => {
  it('is the calendar month of a local date', () => {
    expect(monthOf('2026-03-01', [])).toBe('2026-03');
    expect(monthOf('2026-03-31', [])).toBe('2026-03');
    expect(monthOf('2024-02-29', [])).toBe('2024-02');
    expect(monthOf('2026-12-31', [])).toBe('2026-12');
  });
});

describe('currentMonth', () => {
  it('a moment just after local midnight on the 1st is in the new Month, though UTC is still in the old one', () => {
    // 00:05 on 1 April local is 10:05 on 31 March UTC.
    const moment = new Date(2026, 3, 1, 0, 5);
    expect(moment.getUTCMonth()).toBe(2); // March in UTC
    expect(currentMonth(moment, [])).toBe('2026-04');
  });

  it('a moment just before local midnight on the last day is still in that Month', () => {
    expect(currentMonth(new Date(2026, 0, 31, 23, 59, 59), [])).toBe('2026-01');
    expect(currentMonth(new Date(2026, 1, 1, 0, 0, 0), [])).toBe('2026-02');
  });

  it('handles the year end and leap days', () => {
    // 00:30 on 1 January local is still 31 December in UTC.
    expect(currentMonth(new Date(2027, 0, 1, 0, 30), [])).toBe('2027-01');
    expect(currentMonth(new Date(2026, 11, 31, 23, 59, 59), [])).toBe('2026-12');
    expect(currentMonth(new Date(2028, 1, 29, 12), [])).toBe('2028-02');
    expect(currentMonth(new Date(2028, 2, 1, 0, 1), [])).toBe('2028-03');
  });
});

describe('payDayOptions: changing Pay Day (spec worked examples)', () => {
  /** Months as [name, first day, last day]; the last Month is open-ended so only its first day is checked. */
  type Expected = [Month, string, string?][];
  const expectMonths = (history: PayDayHistory, expected: Expected) => {
    for (const [month, start, end] of expected) {
      const dates = monthDates(month, history);
      expect([month, dates.start, end === undefined ? undefined : dates.end]).toEqual([month, start, end]);
    }
  };

  it.each<[number, number, string, Expected | null, Expected]>([
    [1, 25, '2026-11-10',
      [['2026-11', '2026-11-01', '2026-11-24'], ['2026-12', '2026-11-25']],
      [['2026-11', '2026-11-01', '2026-11-30'], ['2026-12', '2026-12-01', '2026-12-24'], ['2027-01', '2026-12-25']]],
    [1, 26, '2026-11-23',
      [['2026-11', '2026-11-01', '2026-11-25'], ['2026-12', '2026-11-26']],
      [['2026-11', '2026-11-01', '2026-11-30'], ['2026-12', '2026-12-01', '2026-12-25'], ['2027-01', '2026-12-26']]],
    [1, 20, '2026-11-25',
      null,
      [['2026-11', '2026-11-01', '2026-11-30'], ['2026-12', '2026-12-01', '2026-12-19'], ['2027-01', '2026-12-20']]],
    [25, 10, '2026-11-30',
      [['2026-12', '2026-11-25', '2027-01-09'], ['2027-01', '2027-01-10']],
      [['2026-12', '2026-11-25', '2026-12-24'], ['2027-01', '2026-12-25', '2027-02-09'], ['2027-02', '2027-02-10']]],
  ])('Pay Day %i → %i on %s', (from, to, today, startNow, startAfter) => {
    const history = from === 1 ? [] : since(from);
    const options = payDayOptions(history, to, today);
    if (startNow === null) expect(options.startNow).toBeNull();
    else expectMonths(options.startNow!.history, startNow);
    expectMonths(options.startAfterThisMonth.history, startAfter);
  });

  it('records only the new Pay Day and the date its first Month starts', () => {
    const options = payDayOptions([], 25, '2026-11-10');
    expect(options.startNow!.entry).toEqual({ payDay: 25, startsOn: '2026-11-25' });
    expect(options.startAfterThisMonth.entry).toEqual({ payDay: 25, startsOn: '2026-12-25' });
  });

  it('a second change before a pending one takes effect replaces it', () => {
    const pending = payDayOptions([], 25, '2026-11-10').startAfterThisMonth.history;
    const options = payDayOptions(pending, 10, '2026-11-12');
    expect(options.startAfterThisMonth.history).toEqual([{ payDay: 10, startsOn: '2027-01-10' }]);
    expect(monthDates('2026-12', options.startAfterThisMonth.history)).toEqual({ start: '2026-12-01', end: '2027-01-09' });
  });

  it('keeps earlier changes that have already taken effect', () => {
    const earlier = { payDay: 25, startsOn: '2026-11-25' };
    const options = payDayOptions([earlier], 10, '2027-03-01');
    expect(options.startAfterThisMonth.history).toEqual([earlier, { payDay: 10, startsOn: '2027-05-10' }]);
    expect(monthDates('2026-11', options.startAfterThisMonth.history)).toEqual({ start: '2026-11-01', end: '2026-11-24' });
  });

  const todays = ['2026-11-01', '2026-11-14', '2026-11-16', '2026-11-28', '2026-11-30', '2027-02-28'];
  it.each(Array.from({ length: 31 }, (_, i) => i + 1))('from Pay Day %i to any other, neither option redraws a started Month or breaks the name sequence', (from) => {
    for (let to = 1; to <= 31; to++) {
      for (const today of todays) {
        const before = since(from);
        const current = monthOf(today, before);
        const options = payDayOptions(before, to, today);
        const startNow = options.startNow?.history;
        const startAfter = options.startAfterThisMonth.history;

        expect(monthDates(current, startAfter)).toEqual(monthDates(current, before));
        expect(monthDates(addMonths(current, -1), startAfter)).toEqual(monthDates(addMonths(current, -1), before));
        expectContiguousMonths(startAfter, addMonths(current, -1), 6);
        // Settled on the new Pay Day: the Month after the Bridge Month starts on it.
        expect(monthDates(addMonths(current, 2), startAfter).start).toBe(options.startAfterThisMonth.entry.startsOn);

        if (startNow) {
          expect(monthDates(current, startNow).start).toBe(monthDates(current, before).start);
          expect(monthOf(today, startNow)).toBe(current);
          expect(monthDates(addMonths(current, -1), startNow)).toEqual(monthDates(addMonths(current, -1), before));
          expectContiguousMonths(startNow, addMonths(current, -1), 5);
        }
      }
    }
  });

  it('offers Start now only early enough that no Month name is skipped', () => {
    expect(payDayOptions([], 5, '2026-11-03').startNow).not.toBeNull();
    expect(payDayOptions([], 20, '2026-11-19').startNow).not.toBeNull();
    expect(payDayOptions([], 20, '2026-11-20').startNow).toBeNull();
  });
});

describe('changing Pay Day again before an earlier change has fully played out', () => {
  // The "Start after this Month" change 1 → 25 made on 10 Nov: December is a Bridge Month, 1–24 Dec.
  const bridgeTo25 = payDayOptions([], 25, '2026-11-10').startAfterThisMonth.history;
  // The "Start now" change 25 → 10 made on 30 Nov: December runs 25 Nov – 9 Jan.
  const stretchTo10 = payDayOptions(since(25), 10, '2026-11-30').startNow!.history;
  const PAY_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

  it('during a Bridge Month, no option redraws it (Repro A)', () => {
    for (const to of PAY_DAYS) {
      const options = payDayOptions(bridgeTo25, to, '2026-12-10');
      expect([to, monthDates('2026-12', options.startAfterThisMonth.history)]).toEqual([to, { start: '2026-12-01', end: '2026-12-24' }]);
      if (options.startNow) expect([to, monthDates('2026-12', options.startNow.history)]).toEqual([to, { start: '2026-12-01', end: '2026-12-24' }]);
    }
  });

  it('during a Bridge Month, Start after this Month makes the next Month the Bridge to the new Pay Day', () => {
    const { history } = payDayOptions(bridgeTo25, 10, '2026-12-10').startAfterThisMonth;
    expect(monthDates('2027-01', history)).toEqual({ start: '2026-12-25', end: '2027-02-09' });
    expect(monthDates('2027-02', history).start).toBe('2027-02-10');
  });

  it('during a Month stretched by Start now, no option redraws it (Repro B)', () => {
    for (const to of PAY_DAYS) {
      const options = payDayOptions(stretchTo10, to, '2026-12-20');
      expect([to, monthDates('2026-12', options.startAfterThisMonth.history)]).toEqual([to, { start: '2026-11-25', end: '2027-01-09' }]);
      if (options.startNow) expect([to, monthDates('2026-12', options.startNow.history)]).toEqual([to, { start: '2026-11-25', end: '2027-01-09' }]);
    }
  });

  it('every day of an earlier change, for any new Pay Day, keeps started Months and the name sequence', () => {
    const earlier: [string, PayDayHistory][] = [
      ['1 → 25 start after', bridgeTo25],
      ['1 → 25 start now', payDayOptions([], 25, '2026-11-10').startNow!.history],
      ['25 → 10 start now', stretchTo10],
      ['25 → 10 start after', payDayOptions(since(25), 10, '2026-11-30').startAfterThisMonth.history],
      ['1 → 20 start after', payDayOptions([], 20, '2026-11-25').startAfterThisMonth.history],
    ];
    for (const [, before] of earlier) {
      for (let today = '2026-11-30'; today <= '2027-02-15'; today = nextDay(today)) {
        const current = monthOf(today, before);
        for (const to of PAY_DAYS) {
          const options = payDayOptions(before, to, today);
          const startAfter = options.startAfterThisMonth.history;
          for (const month of [addMonths(current, -2), addMonths(current, -1), current]) {
            expect([today, to, month, monthDates(month, startAfter)]).toEqual([today, to, month, monthDates(month, before)]);
          }
          expectContiguousMonths(startAfter, addMonths(current, -2), 6);
          if (options.startNow) {
            const startNow = options.startNow.history;
            expect([today, to, monthDates(addMonths(current, -1), startNow)]).toEqual([today, to, monthDates(addMonths(current, -1), before)]);
            expect([today, to, monthDates(current, startNow).start]).toEqual([today, to, monthDates(current, before).start]);
            expectContiguousMonths(startNow, addMonths(current, -2), 5);
          }
        }
      }
    }
  });
});

describe('payDayState: the Pay Day the Account is on, and the change still pending (spec decision 8)', () => {
  it('is Pay Day 1 with nothing pending for an Account that never changed it', () => {
    expect(payDayState([], '2026-11-10')).toEqual({ payDay: 1, pending: null });
  });

  it('a Start after this Month change is pending until its Bridge Month starts, from the Bridge Month\'s first day', () => {
    const history = payDayOptions([], 25, '2026-11-10').startAfterThisMonth.history;
    expect(payDayState(history, '2026-11-10')).toEqual({ payDay: 1, pending: { payDay: 25, from: '2026-12-01' } });
    expect(payDayState(history, '2026-11-30')).toEqual({ payDay: 1, pending: { payDay: 25, from: '2026-12-01' } });
  });

  it('once the Bridge Month has started, the change is settled and no longer pending', () => {
    const history = payDayOptions([], 25, '2026-11-10').startAfterThisMonth.history;
    expect(payDayState(history, '2026-12-01')).toEqual({ payDay: 25, pending: null });
    expect(payDayState(history, '2026-12-25')).toEqual({ payDay: 25, pending: null });
  });

  it('a Start now change is never pending: it reshapes the Month already under way', () => {
    const history = payDayOptions([], 25, '2026-11-10').startNow!.history;
    expect(payDayState(history, '2026-11-10')).toEqual({ payDay: 25, pending: null });
  });

  it('picking the Pay Day the Account is on during a Bridge Month changes nothing', () => {
    const history = payDayOptions([], 25, '2026-11-10').startAfterThisMonth.history;
    expect(payDayState(history, '2026-12-10').payDay).toBe(25);
  });
});

describe('cancelPendingPayDay', () => {
  it('drops a pending change, so Months stay on the Pay Day in force', () => {
    const history = payDayOptions([], 25, '2026-11-10').startAfterThisMonth.history;
    const kept = cancelPendingPayDay(history, '2026-11-20');
    expect(payDayState(kept, '2026-11-20')).toEqual({ payDay: 1, pending: null });
    expect(monthDates('2026-12', kept)).toEqual({ start: '2026-12-01', end: '2026-12-31' });
  });

  it('keeps changes that have already taken effect', () => {
    const on25 = payDayOptions([], 25, '2026-10-01').startNow!.history;
    const pendingTo10 = payDayOptions(on25, 10, '2026-11-30').startAfterThisMonth.history;
    expect(cancelPendingPayDay(pendingTo10, '2026-12-05')).toEqual(on25);
  });

  it('keeps a change that shapes a Month already under way', () => {
    const startNow = payDayOptions(since(25), 10, '2026-11-30').startNow!.history;
    expect(cancelPendingPayDay(startNow, '2026-12-20')).toEqual(startNow);
  });
});
