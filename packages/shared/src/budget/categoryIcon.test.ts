import { guessCategoryIcon } from './categoryIcon';

describe('guessCategoryIcon', () => {
  it.each([
    ['Rent', 'housing'],
    ['إيجار', 'housing'],
    ['Gym', 'health'],
    ['Doctor', 'health'],
    ['دواء', 'health'],
    ['Uber', 'transport'],
    ['Fuel', 'transport'],
    ['Netflix', 'entertainment'],
    ['School', 'kids'],
    ['Supermarket', 'food-groceries'],
    ['سوبرماركت', 'food-groceries'],
  ])('guesses an icon from the name %s', (name, icon) => {
    expect(guessCategoryIcon(name)).toBe(icon);
  });

  it('matches a keyword inside a longer name, ignoring case and spaces', () => {
    expect(guessCategoryIcon('  Monthly RENT payment ')).toBe('housing');
    expect(guessCategoryIcon('school fees')).toBe('kids');
  });

  it('matches an Arabic word with the definite article or a different alef or taa marbuta', () => {
    expect(guessCategoryIcon('الإيجار')).toBe('housing');
    expect(guessCategoryIcon('ايجار الشقة')).toBe('housing');
    expect(guessCategoryIcon('مدرسه')).toBe('kids');
  });

  it('does not match a keyword hidden inside an unrelated English word', () => {
    // "car" is a transport keyword, but "Scarves" is not a car.
    expect(guessCategoryIcon('Scarves')).toBe('tag');
  });

  it('falls back to tag when nothing matches, or the name is empty', () => {
    expect(guessCategoryIcon('Pets')).toBe('tag');
    expect(guessCategoryIcon('')).toBe('tag');
    expect(guessCategoryIcon('   ')).toBe('tag');
  });
});
