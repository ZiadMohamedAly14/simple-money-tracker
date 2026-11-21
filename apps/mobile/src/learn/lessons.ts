import { APP_ICONS, type AppIconName } from '@/ui/appIcons';

/**
 * The Learn lessons, bundled with the app (no server content, no progress
 * tracking). Each lesson is a topic; its title and body live in the locale
 * files under `learn.lessons.<topic>`, so both languages ship together.
 * Order here is the order the child pages through them.
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

export interface Lesson {
  topic: LessonTopic;
  illustration: AppIconName;
}

export const LESSONS: readonly Lesson[] = LESSON_TOPICS.map((topic) => ({ topic, illustration: lessonIllustration(topic) }));
