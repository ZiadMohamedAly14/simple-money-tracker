import { normalizeEmail, normalizeSignInCode } from './signIn';

describe('normalizeSignInCode', () => {
  it('accepts six Western digits, ignoring spaces', () => {
    expect(normalizeSignInCode('123456')).toBe('123456');
    expect(normalizeSignInCode(' 123 456 ')).toBe('123456');
  });

  it('accepts Arabic-Indic and Persian digits', () => {
    expect(normalizeSignInCode('١٢٣٤٥٦')).toBe('123456');
    expect(normalizeSignInCode('۰۹۸۷۶۵')).toBe('098765');
  });

  it('rejects anything that is not exactly six digits', () => {
    expect(normalizeSignInCode('12345')).toBeNull();
    expect(normalizeSignInCode('1234567')).toBeNull();
    expect(normalizeSignInCode('12a456')).toBeNull();
    expect(normalizeSignInCode('')).toBeNull();
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Sara.Ahmed@Example.COM ')).toBe('sara.ahmed@example.com');
  });
});
