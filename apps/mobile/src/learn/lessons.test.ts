import { ar } from '@/i18n/locales/ar';
import { en } from '@/i18n/locales/en';
import { APP_ICONS } from '@/ui/appIcons';
import { LESSONS, lessonIllustration } from './lessons';

const ARABIC_SCRIPT = /[؀-ۿ]/;

type LessonStrings = Record<string, { title: string; body: string } | undefined>;

describe('Learn lessons', () => {
  it('ships about 8 to 10 lessons, each with its own topic', () => {
    expect(LESSONS.length).toBeGreaterThanOrEqual(8);
    expect(LESSONS.length).toBeLessThanOrEqual(10);
    expect(new Set(LESSONS.map((lesson) => lesson.topic)).size).toBe(LESSONS.length);
  });

  it.each(LESSONS.map((lesson) => [lesson.topic]))('"%s" has a title and body in English and Arabic', (topic) => {
    const english = (en.learn.lessons as LessonStrings)[topic];
    const arabic = (ar.learn.lessons as LessonStrings)[topic];
    expect(english?.title.trim()).toBeTruthy();
    expect(english?.body.trim()).toBeTruthy();
    expect(arabic?.title).toMatch(ARABIC_SCRIPT);
    expect(arabic?.body).toMatch(ARABIC_SCRIPT);
  });
});

describe('lesson illustrations', () => {
  it('falls back to the jar of coins when a topic has no drawing of its own', () => {
    expect(lessonIllustration('giving', { 'learn-illustration-jar-coins': {} })).toBe('learn-illustration-jar-coins');
  });

  it('uses learn-illustration-<topic> once that drawing is in the icon set', () => {
    const icons = { 'learn-illustration-jar-coins': {}, 'learn-illustration-giving': {} };
    expect(lessonIllustration('giving', icons)).toBe('learn-illustration-giving');
    expect(lessonIllustration('saving', icons)).toBe('learn-illustration-jar-coins');
  });

  it('gives every bundled lesson an illustration from the app icon set', () => {
    for (const lesson of LESSONS) {
      expect(lesson.illustration).toMatch(/^learn-illustration-/);
      expect(APP_ICONS).toHaveProperty([lesson.illustration]);
    }
  });
});
