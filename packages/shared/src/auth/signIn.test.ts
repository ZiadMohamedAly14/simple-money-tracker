import { findSignInCode, normalizeEmail, normalizeSignInCode } from './signIn';

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

describe('findSignInCode', () => {
  it('finds the code in pasted text, such as a line copied from the email', () => {
    expect(findSignInCode('482913')).toBe('482913');
    expect(findSignInCode('Your Mizan code is 482913. It expires in 10 minutes.')).toBe('482913');
    expect(findSignInCode('رمز ميزان الخاص بك هو ٤٨٢٩١٣')).toBe('482913');
  });

  it('accepts the code split into two groups of three', () => {
    expect(findSignInCode('482 913')).toBe('482913');
    expect(findSignInCode('code: 482-913')).toBe('482913');
  });

  it('ignores digit runs that are not exactly six long', () => {
    expect(findSignInCode('expires in 10 minutes')).toBeNull();
    expect(findSignInCode('call 0123456789')).toBeNull();
    expect(findSignInCode('')).toBeNull();
  });
});
