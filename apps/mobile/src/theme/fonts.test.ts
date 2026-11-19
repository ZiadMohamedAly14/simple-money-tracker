import { fontFamily } from './fonts';

describe('fontFamily', () => {
  it('uses Inter for English', () => {
    expect(fontFamily('en', 'regular')).toBe('Inter_400Regular');
    expect(fontFamily('en', 'bold')).toBe('Inter_700Bold');
  });

  it('uses Alexandria for Arabic', () => {
    expect(fontFamily('ar', 'medium')).toBe('Alexandria_500Medium');
    expect(fontFamily('ar', 'semibold')).toBe('Alexandria_600SemiBold');
  });
});
