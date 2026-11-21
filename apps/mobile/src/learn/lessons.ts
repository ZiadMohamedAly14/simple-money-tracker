import type { ColorScheme } from '@/theme/appearance';
import { APP_ICONS, type AppIconName } from '@/ui/appIcons';

/**
 * The Learn lessons, bundled with the app (no server content, no progress
 * tracking). Each lesson is a topic; its title and body live in the locale
 * files under `learn.lessons.<topic>`, so both languages ship together.
 * Order here is the order they come up, one a day (`lessonOfTheDay`).
 */
export const LESSON_TOPICS = [
  'saving',
  'jars',
  'needs-and-wants',
  'think-first',
  'waiting',
  'giving',
  'comparing',
  'earning',
  'running-low',
] as const;

export type LessonTopic = (typeof LESSON_TOPICS)[number];

/** The picture a lesson falls back to when its own drawing is missing. */
export const FALLBACK_LESSON_ILLUSTRATION = 'learn-illustration-jar-coins' satisfies AppIconName;

/**
 * Which drawing each lesson shows. The drawings' file names don't follow the
 * topic keys (waiting → patience), so each lesson names its own. To change a
 * lesson's picture, add `assets/icon/learn-illustration-<name>.svg`, its line
 * in `src/ui/appIcons.ts`, and point the lesson at it here.
 */
export const LESSON_ILLUSTRATIONS: Readonly<Record<LessonTopic, `learn-illustration-${string}`>> = {
  saving: 'learn-illustration-saving-goal',
  jars: 'learn-illustration-jar-coins',
  'needs-and-wants': 'learn-illustration-needs-wants',
  'think-first': 'learn-illustration-spending-choices',
  waiting: 'learn-illustration-patience',
  giving: 'learn-illustration-giving',
  comparing: 'learn-illustration-compare-prices',
  earning: 'learn-illustration-earning',
  'running-low': 'learn-illustration-budget',
};

/** A lesson's picture: its drawing from LESSON_ILLUSTRATIONS if the icon set has it, the jar of coins otherwise. */
export function lessonIllustration(
  topic: LessonTopic,
  icons: Readonly<Record<string, unknown>> = APP_ICONS,
  illustrations: Readonly<Record<LessonTopic, string>> = LESSON_ILLUSTRATIONS,
): AppIconName {
  const own = illustrations[topic];
  return (Object.hasOwn(icons, own) ? own : FALLBACK_LESSON_ILLUSTRATION) as AppIconName;
}

/**
 * The drawing to show in the active colour scheme: in dark mode its
 * `-dark` variant (redrawn to read on the dark Card), or the light drawing
 * when there is no dark one.
 */
export function illustrationForScheme(
  illustration: AppIconName,
  scheme: ColorScheme,
  icons: Readonly<Record<string, unknown>> = APP_ICONS,
): AppIconName {
  const dark = `${illustration}-dark`;
  return (scheme === 'dark' && Object.hasOwn(icons, dark) ? dark : illustration) as AppIconName;
}

export interface Lesson {
  topic: LessonTopic;
  illustration: AppIconName;
}

export const LESSONS: readonly Lesson[] = LESSON_TOPICS.map((topic) => ({ topic, illustration: lessonIllustration(topic) }));

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The lesson for a local date (`YYYY-MM-DD`): one a day, in LESSONS order,
 * starting over after the last. It depends only on the date, so every device
 * shows the same lesson that day, offline, with nothing stored or tracked.
 */
export function lessonOfTheDay(date: string): Lesson {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
  return LESSONS[dayNumber % LESSONS.length]!;
}
