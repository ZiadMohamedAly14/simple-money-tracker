import { customSplit, presetOf, presetSplit, suggestTopUpSplit, topUpSplitProblem } from './topUpSplit';

const SAVE = 'save-jar';
const SPEND = 'spend-jar';
const GIVE = 'give-jar';

describe('topUpSplitProblem', () => {
  it('accepts a split that adds up exactly to the total', () => {
    expect(
      topUpSplitProblem(10000, [
        { jarId: SAVE, amount: 4000 },
        { jarId: SPEND, amount: 5000 },
        { jarId: GIVE, amount: 1000 },
      ]),
    ).toBeNull();
  });

  it('refuses a split that adds up to less or more than the total', () => {
    expect(topUpSplitProblem(10000, [{ jarId: SPEND, amount: 9999 }])).toBe('must add up to the total');
    expect(
      topUpSplitProblem(10000, [
        { jarId: SAVE, amount: 5000 },
        { jarId: SPEND, amount: 5001 },
      ]),
    ).toBe('must add up to the total');
  });

  it('refuses an empty split', () => {
    expect(topUpSplitProblem(10000, [])).toBe('must name at least one Jar');
  });

  it('refuses a zero, negative or fractional share, even when the sum is right', () => {
    expect(
      topUpSplitProblem(10000, [
        { jarId: SAVE, amount: 0 },
        { jarId: SPEND, amount: 10000 },
      ]),
    ).toBe('each share must be a positive whole number of minor units');
    expect(
      topUpSplitProblem(10000, [
        { jarId: SAVE, amount: -500 },
        { jarId: SPEND, amount: 10500 },
      ]),
    ).toBe('each share must be a positive whole number of minor units');
    expect(
      topUpSplitProblem(10000, [
        { jarId: SAVE, amount: 0.5 },
        { jarId: SPEND, amount: 9999.5 },
      ]),
    ).toBe('each share must be a positive whole number of minor units');
  });

  it('refuses the same Jar twice', () => {
    expect(
      topUpSplitProblem(10000, [
        { jarId: SPEND, amount: 5000 },
        { jarId: SPEND, amount: 5000 },
      ]),
    ).toBe('each Jar may appear once');
  });
});

describe('suggestTopUpSplit', () => {
  const jars = [SAVE, SPEND, GIVE];

  it('with no earlier Top-up, puts everything in Spend', () => {
    expect(suggestTopUpSplit(5000, { jarIds: jars, spendJarId: SPEND, lastSplit: null })).toEqual([
      { jarId: SPEND, amount: 5000 },
    ]);
  });

  it('repeats the last split’s proportions for a new total', () => {
    const lastSplit = [
      { jarId: SAVE, amount: 2000 },
      { jarId: SPEND, amount: 2000 },
      { jarId: GIVE, amount: 1000 },
    ];
    expect(suggestTopUpSplit(10000, { jarIds: jars, spendJarId: SPEND, lastSplit })).toEqual([
      { jarId: SAVE, amount: 4000 },
      { jarId: SPEND, amount: 4000 },
      { jarId: GIVE, amount: 2000 },
    ]);
  });

  it('gives any rounding remainder to Spend, so the split adds up exactly', () => {
    const thirds = [
      { jarId: SAVE, amount: 100 },
      { jarId: SPEND, amount: 100 },
      { jarId: GIVE, amount: 100 },
    ];
    expect(suggestTopUpSplit(1000, { jarIds: jars, spendJarId: SPEND, lastSplit: thirds })).toEqual([
      { jarId: SAVE, amount: 333 },
      { jarId: SPEND, amount: 334 },
      { jarId: GIVE, amount: 333 },
    ]);
  });

  it('leaves out a Jar whose share rounds to nothing', () => {
    const lastSplit = [
      { jarId: SAVE, amount: 1 },
      { jarId: SPEND, amount: 999 },
    ];
    expect(suggestTopUpSplit(10, { jarIds: jars, spendJarId: SPEND, lastSplit })).toEqual([{ jarId: SPEND, amount: 10 }]);
  });

  it('moves the share of a Jar that has since been archived to Spend', () => {
    const lastSplit = [
      { jarId: SAVE, amount: 5000 },
      { jarId: GIVE, amount: 5000 },
    ];
    expect(suggestTopUpSplit(2000, { jarIds: [SAVE, SPEND], spendJarId: SPEND, lastSplit })).toEqual([
      { jarId: SAVE, amount: 1000 },
      { jarId: SPEND, amount: 1000 },
    ]);
  });

  it('uses the first Jar when Spend itself is archived', () => {
    expect(suggestTopUpSplit(5000, { jarIds: [SAVE, GIVE], spendJarId: SPEND, lastSplit: null })).toEqual([
      { jarId: SAVE, amount: 5000 },
    ]);
  });

  it('suggests nothing for a zero total or a wallet with no Jars', () => {
    expect(suggestTopUpSplit(0, { jarIds: jars, spendJarId: SPEND, lastSplit: null })).toEqual([]);
    expect(suggestTopUpSplit(5000, { jarIds: [], spendJarId: SPEND, lastSplit: null })).toEqual([]);
  });
});

describe('presetSplit', () => {
  const jars = { jarIds: [SAVE, SPEND, GIVE], spendJarId: SPEND, lastSplit: null };

  it('splits evenly across the Jars, with the rounding remainder in Spend', () => {
    expect(presetSplit('evenly', 10000, jars)).toEqual([
      { jarId: SAVE, amount: 3333 },
      { jarId: SPEND, amount: 3334 },
      { jarId: GIVE, amount: 3333 },
    ]);
  });

  const lastSplit = [
    { jarId: SAVE, amount: 2000 },
    { jarId: SPEND, amount: 3000 },
  ];

  it('puts everything in Spend for All to Spend, whatever the last split was', () => {
    expect(presetSplit('allToSpend', 5000, { ...jars, lastSplit })).toEqual([{ jarId: SPEND, amount: 5000 }]);
  });

  it('repeats the last split’s proportions for Same as last time', () => {
    expect(presetSplit('sameAsLast', 10000, { ...jars, lastSplit })).toEqual([
      { jarId: SAVE, amount: 4000 },
      { jarId: SPEND, amount: 6000 },
    ]);
  });
});

describe('presetOf', () => {
  const jars = { jarIds: [SAVE, SPEND, GIVE], spendJarId: SPEND, lastSplit: null };

  it('recognises an even split, remainder and all', () => {
    const split = [
      { jarId: SAVE, amount: 333 },
      { jarId: SPEND, amount: 334 },
      { jarId: GIVE, amount: 333 },
    ];
    expect(presetOf(1000, split, jars)).toBe('evenly');
  });

  it('recognises everything in Spend as All to Spend', () => {
    expect(presetOf(5000, [{ jarId: SPEND, amount: 5000 }], jars)).toBe('allToSpend');
  });

  it('recognises the last split only when one is given', () => {
    const lastSplit = [
      { jarId: SAVE, amount: 1000 },
      { jarId: SPEND, amount: 4000 },
    ];
    const split = [
      { jarId: SAVE, amount: 2000 },
      { jarId: SPEND, amount: 8000 },
    ];
    expect(presetOf(10000, split, { ...jars, lastSplit })).toBe('sameAsLast');
    expect(presetOf(10000, split, jars)).toBeNull();
  });

  it('calls any other split custom', () => {
    const split = [
      { jarId: SAVE, amount: 5000 },
      { jarId: SPEND, amount: 5000 },
    ];
    expect(presetOf(10000, split, jars)).toBeNull();
  });
});

describe('customSplit', () => {
  const jars = { jarIds: [SAVE, SPEND, GIVE], spendJarId: SPEND };

  it('gives Spend whatever the typed shares leave', () => {
    expect(customSplit(10000, { total: 10000, shares: { [SAVE]: 5000, [GIVE]: 1000 } }, jars)).toEqual({
      splits: [
        { jarId: SAVE, amount: 5000 },
        { jarId: SPEND, amount: 4000 },
        { jarId: GIVE, amount: 1000 },
      ],
      over: 0,
    });
  });

  it('keeps the typed proportions when the total changes', () => {
    expect(customSplit(20000, { total: 10000, shares: { [SAVE]: 5000, [GIVE]: 1000 } }, jars)).toEqual({
      splits: [
        { jarId: SAVE, amount: 10000 },
        { jarId: SPEND, amount: 8000 },
        { jarId: GIVE, amount: 2000 },
      ],
      over: 0,
    });
  });

  it('reports how far the typed shares go past the total, leaving Spend empty', () => {
    expect(customSplit(10000, { total: 10000, shares: { [SAVE]: 8000, [GIVE]: 3000 } }, jars)).toEqual({
      splits: [
        { jarId: SAVE, amount: 8000 },
        { jarId: GIVE, amount: 3000 },
      ],
      over: 1000,
    });
  });

  it('balances with the first Jar when Spend is archived, ignoring a share typed for it', () => {
    expect(
      customSplit(10000, { total: 10000, shares: { [SAVE]: 9999, [GIVE]: 2000 } }, { jarIds: [SAVE, GIVE], spendJarId: SPEND }),
    ).toEqual({
      splits: [
        { jarId: SAVE, amount: 8000 },
        { jarId: GIVE, amount: 2000 },
      ],
      over: 0,
    });
  });
});
