import { ar } from '@/i18n/locales/ar';
import { en } from '@/i18n/locales/en';
import { APP_ICONS } from '@/ui/appIcons';
import { LESSONS, LESSON_ILLUSTRATIONS, illustrationForScheme, lessonIllustration } from './lessons';

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
  it('uses the dark drawing in dark mode and the light one in light mode', () => {
    expect(illustrationForScheme('learn-illustration-patience', 'dark')).toBe('learn-illustration-patience-dark');
    expect(illustrationForScheme('learn-illustration-patience', 'light')).toBe('learn-illustration-patience');
  });

  it('falls back to the light drawing in dark mode when there is no dark one', () => {
    const icons = { 'learn-illustration-patience': {} };
    expect(illustrationForScheme('learn-illustration-patience', 'dark', icons)).toBe('learn-illustration-patience');
  });

  it('has a dark drawing for every lesson', () => {
    for (const lesson of LESSONS) expect(APP_ICONS).toHaveProperty([`${lesson.illustration}-dark`]);
  });

  it("falls back to the jar of coins when a lesson's drawing is missing from the icon set", () => {
    expect(lessonIllustration('waiting', { 'learn-illustration-jar-coins': {} })).toBe('learn-illustration-jar-coins');
  });

  it("uses the lesson's named drawing, not one derived from its topic key", () => {
    const icons = { 'learn-illustration-jar-coins': {}, 'learn-illustration-patience': {}, 'learn-illustration-waiting': {} };
    expect(lessonIllustration('waiting', icons)).toBe('learn-illustration-patience');
    expect(lessonIllustration('saving', icons)).toBe('learn-illustration-jar-coins');
  });

  it('gives each lesson the drawing made for it', () => {
    expect(LESSONS.map((lesson) => [lesson.topic, lesson.illustration])).toEqual([
      ['saving', 'learn-illustration-saving-goal'],
      ['jars', 'learn-illustration-jar-coins'],
      ['needs-and-wants', 'learn-illustration-needs-wants'],
      ['think-first', 'learn-illustration-spending-choices'],
      ['waiting', 'learn-illustration-patience'],
      ['giving', 'learn-illustration-giving'],
      ['comparing', 'learn-illustration-compare-prices'],
      ['earning', 'learn-illustration-earning'],
      ['running-low', 'learn-illustration-budget'],
    ]);
  });

  it('names a drawing that exists for every lesson', () => {
    for (const illustration of Object.values(LESSON_ILLUSTRATIONS)) expect(APP_ICONS).toHaveProperty([illustration]);
  });

  it('gives every bundled lesson an illustration from the app icon set', () => {
    for (const lesson of LESSONS) {
      expect(lesson.illustration).toMatch(/^learn-illustration-/);
      expect(APP_ICONS).toHaveProperty([lesson.illustration]);
    }
  });
});
