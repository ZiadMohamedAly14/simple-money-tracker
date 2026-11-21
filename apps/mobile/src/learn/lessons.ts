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

/** The illustration every lesson uses until it has a drawing of its own. */
export const FALLBACK_LESSON_ILLUSTRATION = 'learn-illustration-jar-coins' satisfies AppIconName;

/**
 * A lesson's picture: `learn-illustration-<topic>` from the custom icon set if
 * that drawing exists, the jar of coins otherwise. To give a lesson its own
 * picture, add `assets/icon/learn-illustration-<topic>.svg` and its line in
 * `src/ui/appIcons.ts`; nothing here needs to change.
 */
export function lessonIllustration(topic: LessonTopic, icons: Readonly<Record<string, unknown>> = APP_ICONS): AppIconName {
  const own = `learn-illustration-${topic}`;
  return (Object.hasOwn(icons, own) ? own : FALLBACK_LESSON_ILLUSTRATION) as AppIconName;
}

export interface Lesson {
  topic: LessonTopic;
  illustration: AppIconName;
}

export const LESSONS: readonly Lesson[] = LESSON_TOPICS.map((topic) => ({ topic, illustration: lessonIllustration(topic) }));
