import { joinSpoken } from './spoken';

describe('joinSpoken', () => {
  it('joins the shown pieces with the language separator', () => {
    expect(joinSpoken(['Food', 'Today · lunch', '-120.00'], ', ')).toBe('Food, Today · lunch, -120.00');
    expect(joinSpoken(['طعام', '١٢٠'], '، ')).toBe('طعام، ١٢٠');
  });

  it('drops missing and blank pieces', () => {
    expect(joinSpoken(['Food', undefined, null, false, '', '  ', '50'], ', ')).toBe('Food, 50');
    expect(joinSpoken([undefined], ', ')).toBe('');
  });
});
