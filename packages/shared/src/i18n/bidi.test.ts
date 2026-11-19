import { ltrIsolate } from './bidi';

describe('ltrIsolate', () => {
  it('wraps left-to-right content (an email, "spent / budget") in a direction isolate', () => {
    expect(ltrIsolate('name@email.com')).toBe('⁦name@email.com⁩');
  });
});
