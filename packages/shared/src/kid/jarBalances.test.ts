import { jarBalances } from './jarBalances';

const SAVE = 'save-jar';
const SPEND = 'spend-jar';
const GIVE = 'give-jar';

const topUp = (amount: number, splits: { jarId: string; amount: number }[]) => ({ kind: 'topUp' as const, amount, splits });

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
});
