import { categoryStatus } from './categoryStatus';

describe('categoryStatus', () => {
  it('Other spending above its budget is Covered while Unallocated can absorb it', () => {
    expect(categoryStatus({ isOther: true, budget: 0, spent: 10000 }, 20000)).toBe('covered');
  });

  it('Other is over, by its whole overspend, once that is more than Unallocated', () => {
    expect(categoryStatus({ isOther: true, budget: 0, spent: 30000 }, 20000)).toBe('over');
  });

  it('a Category within its budget has money left, Other included', () => {
    expect(categoryStatus({ isOther: false, budget: 50000, spent: 20000 }, 0)).toBe('left');
    expect(categoryStatus({ isOther: true, budget: 0, spent: 0 }, 100000)).toBe('left');
  });

  it('a Category other than Other is over even when Unallocated could cover it', () => {
    expect(categoryStatus({ isOther: false, budget: 50000, spent: 60000 }, 100000)).toBe('over');
  });

  it('Other is over when Unallocated is zero or below', () => {
    expect(categoryStatus({ isOther: true, budget: 0, spent: 10000 }, 0)).toBe('over');
    expect(categoryStatus({ isOther: true, budget: 0, spent: 10000 }, -5000)).toBe('over');
  });
});
