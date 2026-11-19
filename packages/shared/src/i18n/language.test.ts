import { directionChanges, isRtl, resolveLanguage } from './language';

describe('resolveLanguage', () => {
  it.each([
    ['an Arabic phone', ['ar'], 'ar'],
    ['an Arabic regional variant', ['ar-EG'], 'ar'],
    ['an English phone', ['en-GB'], 'en'],
    ['an unsupported first language falling back to the next one', ['fr-FR', 'ar-SA'], 'ar'],
    ['only unsupported languages', ['fr', 'de'], 'en'],
    ['no device languages', [], 'en'],
    ['mixed-case tags', ['AR'], 'ar'],
  ])('picks the app language for %s', (_label, deviceLanguages, expected) => {
    expect(resolveLanguage(deviceLanguages)).toBe(expected);
  });
});

describe('direction', () => {
  it('is right-to-left only for Arabic', () => {
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('en')).toBe(false);
  });

  it('changes when switching to or from Arabic, which needs a restart', () => {
    expect(directionChanges('en', 'ar')).toBe(true);
    expect(directionChanges('ar', 'en')).toBe(true);
    expect(directionChanges('en', 'en')).toBe(false);
  });
});
