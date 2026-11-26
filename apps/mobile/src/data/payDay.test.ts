import { monthDates, payDayOptions } from '@money-tracker/shared';
import { cancelPendingPayDay, payDayState } from './payDay';

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
});
