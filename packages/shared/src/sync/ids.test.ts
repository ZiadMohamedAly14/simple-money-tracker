import { isUuid, otherCategoryId, uuidv7 } from './ids';

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
