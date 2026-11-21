# 16: Learn

**What to build:** A child opens Learn and reads short lesson cards about money, in their language, fully offline.

**Blocked by:** 12 (Kid Profiles, Jars and Top-ups).

**Status:** resolved

- [x] About 8–10 lesson cards bundled with the app (saving, needs and wants, giving, …) in English and Arabic. Placeholder text is acceptable until final copy arrives.
- [x] Learn is reachable from the Kid experience's navigation and renders correctly right to left.
- [x] No progress tracking or server content.

## Comments

Built on `ticket/16-learn`:

- **Lessons (`apps/mobile/src/learn/lessons.ts`):** nine topics in paging order: `saving`, `jars`, `needs-and-wants`, `think-first`, `waiting`, `giving`, `comparing`, `earning`, `running-low`. The text lives in the locale files under `learn.lessons.<topic>.{title,body}` (EN and AR, placeholder copy; the Arabic is typed against English, so a missing key fails typecheck). `lessons.test.ts` checks there are 8–10 lessons with distinct topics and that each has English text and Arabic-script text.
- **Illustrations:** `lessonIllustration(topic)` returns `learn-illustration-<topic>` when that SVG is in the custom icon set and `learn-illustration-jar-coins` otherwise; every lesson gets its picture this way. To give a lesson its own drawing, add `apps/mobile/assets/icon/learn-illustration-<topic>.svg` plus its line in `src/ui/appIcons.ts` (the existing registry test asks for that line). No other change is needed.
- **Screen (`apps/mobile/app/learn.tsx`):** Kid theme, following PDF pages 9–10. A back button and "Learn" title, a white card with the illustration, title and body, progress dots (which follow the layout direction, so the first dot is on the right in Arabic), and Next, which becomes Done on the last lesson and goes back. The dots carry a "Lesson N of 9" accessibility label. The screen is fully bundled and offline, with no progress tracking and no server content.
- **Navigation:** a "Learn about money" row (`app:learn`) on the kid's wallet (`parent/kids/[id]`) opens `/learn`. The route is at the root, outside the PIN-gated Parent Area, so the Kid-Mode home from ticket 14 can link to it directly.

**Left over / notes:**
- The Kid-Mode device home doesn't exist yet (ticket 14). When it's built, add the same `app:learn` entry there with `router.push('/learn')`.
- You can only move forward with Next (as in the mockup), plus back to leave. There's no swipe or previous button, and Learn always opens at the first lesson.
- Lesson copy is placeholder. Final English and Arabic text is still open in the spec.

**Human follow-up:**
- Replace the placeholder lesson text in `src/i18n/locales/en.ts` and `ar.ts` (`learn.lessons`) when the final copy arrives.
- Optionally draw `learn-illustration-<topic>.svg` for any of the nine topics above.
- Manual device check in English and Arabic (RTL): open Learn from a kid's wallet, page through all nine cards to Done, check that the dots run right to left in Arabic and that the text wraps well at large font sizes, and confirm it works in airplane mode.
