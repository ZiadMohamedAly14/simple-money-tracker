import {
  accountSettingsId,
  categoryBudgetId,
  defaultCategoryId,
  isUuid,
  monthPlanId,
  otherCategoryId,
  uuidv7,
} from './ids';

const zeros = (n: number) => new Uint8Array(n);
const ones = (n: number) => new Uint8Array(n).fill(0xff);

describe('uuidv7', () => {
  it('puts the millisecond time first, then version 7 and the RFC variant', () => {
    // 2026-03-01T09:00:00.000Z = 1772355600000 ms = 0x019CA8A03E80
    const id = uuidv7(1772355600000, zeros);
    expect(id).toBe('019ca8a0-3e80-7000-8000-000000000000');
    expect(isUuid(id)).toBe(true);
  });

  it('fills the rest with the random bytes it is given', () => {
    expect(uuidv7(0, ones)).toBe('00000000-0000-7fff-bfff-ffffffffffff');
  });

  it('sorts by creation time', () => {
    const earlier = uuidv7(1_000, ones);
    const later = uuidv7(1_001, zeros);
    expect([later, earlier].sort()).toEqual([earlier, later]);
  });
});

describe('isUuid', () => {
  it('accepts lowercase hyphenated UUIDs only', () => {
    expect(isUuid('019ca88e-0e80-7000-8000-000000000000')).toBe(true);
    expect(isUuid('019CA88E-0E80-7000-8000-000000000000')).toBe(false);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid(42)).toBe(false);
  });
});

describe('otherCategoryId', () => {
  it('is the same UUID on every device for one Account', () => {
    const accountId = '65f1a2b3c4d5e6f708192a3b';
    expect(otherCategoryId(accountId)).toBe('65f1a2b3-c4d5-8e6f-8708-192a3b000001');
    expect(otherCategoryId(accountId)).toBe(otherCategoryId(accountId));
    expect(isUuid(otherCategoryId(accountId))).toBe(true);
  });

  it('differs between Accounts', () => {
    expect(otherCategoryId('65f1a2b3c4d5e6f708192a3b')).not.toBe(otherCategoryId('65f1a2b3c4d5e6f708192a3c'));
  });

  it('rejects an Account id that is not a 24-hex ObjectId', () => {
    expect(() => otherCategoryId('nope')).toThrow();
  });
});

describe('deterministic IDs', () => {
  const sara = '65f1a2b3c4d5e6f708192a3b';
  const omar = '65f1a2b3c4d5e6f708192a3c';
  const food = '019ca8a0-3e80-7000-8000-000000000001';
  const rent = '019ca8a0-3e80-7000-8000-000000000002';

  it('a Month plan has one ID per Account and Month, the same on every device', () => {
    expect(monthPlanId(sara, '2026-03')).toBe(monthPlanId(sara, '2026-03'));
    expect(isUuid(monthPlanId(sara, '2026-03'))).toBe(true);
    expect(monthPlanId(sara, '2026-03')).not.toBe(monthPlanId(sara, '2026-04'));
    expect(monthPlanId(sara, '2026-03')).not.toBe(monthPlanId(omar, '2026-03'));
  });

  it('a Category Budget has one ID per Account, Month and Category', () => {
    expect(categoryBudgetId(sara, '2026-03', food)).toBe(categoryBudgetId(sara, '2026-03', food));
    expect(isUuid(categoryBudgetId(sara, '2026-03', food))).toBe(true);
    const others = [
      categoryBudgetId(sara, '2026-03', rent),
      categoryBudgetId(sara, '2026-04', food),
      categoryBudgetId(omar, '2026-03', food),
      monthPlanId(sara, '2026-03'),
    ];
    expect(others).not.toContain(categoryBudgetId(sara, '2026-03', food));
  });

  it("an Account's settings and default Categories have fixed IDs", () => {
    expect(accountSettingsId(sara)).toBe('65f1a2b3-c4d5-8e6f-8708-192a3b000002');
    expect(accountSettingsId(sara)).not.toBe(otherCategoryId(sara));
    expect(defaultCategoryId(sara, 'food')).toBe(defaultCategoryId(sara, 'food'));
    expect(isUuid(defaultCategoryId(sara, 'food'))).toBe(true);
    expect(defaultCategoryId(sara, 'food')).not.toBe(defaultCategoryId(sara, 'housing'));
    expect(defaultCategoryId(sara, 'food')).not.toBe(defaultCategoryId(omar, 'food'));
  });

  it('never changes, because the IDs are stored', () => {
    // Worked out separately with Node's crypto: UUIDv8 from SHA-256("<kind>\n<accountId>\n<parts…>").
    expect(monthPlanId(sara, '2026-03')).toBe('f336ea85-61f9-8630-a1fa-960e50ed0bc1');
    expect(categoryBudgetId(sara, '2026-03', food)).toBe('10cce712-9c9c-839b-909b-361b8c2b8948');
    expect(defaultCategoryId(sara, 'food')).toBe('a7e4cc1b-28d7-84f7-9b00-900d259966ff');
  });
});
