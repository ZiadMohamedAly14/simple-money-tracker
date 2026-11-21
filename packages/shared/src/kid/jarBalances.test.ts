import { jarBalances, negativeJarIds, spendableFrom } from './jarBalances';

const SAVE = 'save-jar';
const SPEND = 'spend-jar';
const GIVE = 'give-jar';

const topUp = (amount: number, splits: { jarId: string; amount: number }[]) =>
  ({ kind: 'topUp' as const, amount, splits, jarId: null, toJarId: null });
const kidExpense = (amount: number, jarId: string) => ({ kind: 'kidExpense' as const, amount, splits: [], jarId, toJarId: null });
const jarTransfer = (amount: number, jarId: string, toJarId: string) =>
  ({ kind: 'jarTransfer' as const, amount, splits: [], jarId, toJarId });

describe('jarBalances', () => {
  it('a new Kid Wallet has every Jar at zero', () => {
    expect(jarBalances([SAVE, SPEND, GIVE], [])).toEqual({ [SAVE]: 0, [SPEND]: 0, [GIVE]: 0 });
  });

  it('each Top-up adds its split to the Jars it names', () => {
    const balances = jarBalances(
      [SAVE, SPEND, GIVE],
      [
        topUp(5000, [{ jarId: SPEND, amount: 5000 }]),
        topUp(10000, [
          { jarId: SAVE, amount: 4000 },
          { jarId: SPEND, amount: 5000 },
          { jarId: GIVE, amount: 1000 },
        ]),
      ],
    );
    expect(balances).toEqual({ [SAVE]: 4000, [SPEND]: 10000, [GIVE]: 1000 });
  });

  it('keeps money in a Jar that is not listed (an archived Jar still holds its balance)', () => {
    const balances = jarBalances(
      [SPEND],
      [
        topUp(3000, [
          { jarId: SAVE, amount: 1000 },
          { jarId: SPEND, amount: 2000 },
        ]),
      ],
    );
    expect(balances).toEqual({ [SAVE]: 1000, [SPEND]: 2000 });
  });

  it('a Kid Expense comes out of its Jar', () => {
    const balances = jarBalances([SAVE, SPEND], [topUp(5000, [{ jarId: SPEND, amount: 5000 }]), kidExpense(1500, SPEND)]);
    expect(balances).toEqual({ [SAVE]: 0, [SPEND]: 3500 });
  });

  it('a Jar Transfer moves money from one Jar to another, leaving the total alone', () => {
    const balances = jarBalances([SAVE, SPEND], [topUp(5000, [{ jarId: SAVE, amount: 5000 }]), jarTransfer(2000, SAVE, SPEND)]);
    expect(balances).toEqual({ [SAVE]: 3000, [SPEND]: 2000 });
  });

  it('can go below zero when two offline Kid Expenses both spent the same money', () => {
    const balances = jarBalances([SPEND], [topUp(1000, [{ jarId: SPEND, amount: 1000 }]), kidExpense(800, SPEND), kidExpense(800, SPEND)]);
    expect(balances).toEqual({ [SPEND]: -600 });
  });
});

describe('spendableFrom', () => {
  it("is the Jar's balance", () => {
    expect(spendableFrom({ [SPEND]: 2500 }, SPEND)).toBe(2500);
  });

  it('is never below zero, so a negative Jar blocks any spending', () => {
    expect(spendableFrom({ [SPEND]: -600 }, SPEND)).toBe(0);
  });

  it('when editing a Kid Expense from the same Jar, counts its old amount as available again', () => {
    expect(spendableFrom({ [SPEND]: 500 }, SPEND, kidExpense(1500, SPEND))).toBe(2000);
  });

  it("when editing a Kid Expense into another Jar, only that Jar's balance counts", () => {
    expect(spendableFrom({ [SPEND]: 500, [SAVE]: 300 }, SAVE, kidExpense(1500, SPEND))).toBe(300);
  });
});

describe('negativeJarIds', () => {
  it('lists the Jars below zero', () => {
    expect(negativeJarIds({ [SAVE]: 100, [SPEND]: -600, [GIVE]: 0 })).toEqual([SPEND]);
  });
});
