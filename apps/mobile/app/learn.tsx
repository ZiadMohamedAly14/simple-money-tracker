import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { toLocalDate } from '@money-tracker/shared';
import { illustrationForScheme, lessonOfTheDay } from '@/learn/lessons';
import { useColorScheme } from '@/theme/appearanceStore';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { AppIcon, Button, Card, Screen, ScreenHeader, Text } from '@/ui';

/**
 * Learn (PDF pages 9–10): today's lesson card, in the Kid theme. One lesson a
 * day, picked from the date (`lessonOfTheDay`), so every device shows the same
 * one and a new one comes up tomorrow. Lessons are bundled
 * (`src/learn/lessons.ts`), so it works fully offline; nothing is tracked.
 * Lives outside the Parent Area so a Kid-Mode device can open it too.
 */
export default function LearnScreen() {
  return (
    <ThemeProvider name="kid">
      <Learn />
    </ThemeProvider>
  );
}

function Learn() {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const lesson = lessonOfTheDay(toLocalDate(new Date()));

  return (
    // Scrolls so a long lesson (bigger Arabic type, small phones) is never cut off; grow keeps the card filling the screen.
    <Screen
      scroll
      className="grow"
      footer={
        <>
          <Text tone="muted" align="center" className="pb-2 text-sm">
            {t('learn.comeBack')}
          </Text>
          <Button large label={t('learn.done')} onPress={() => router.back()} />
        </>
      }
    >
      <ScreenHeader title={t('learn.today')} onBack={() => router.back()} />
      <Card className="flex-1 items-center justify-center gap-4 px-6 py-8">
        <AppIcon name={illustrationForScheme(lesson.illustration, scheme)} size={160} />
        <Text weight="bold" align="center" accessibilityRole="header" className="text-2xl">
          {t(`learn.lessons.${lesson.topic}.title`)}
        </Text>
        <Text tone="muted" align="center" className="text-lg">
          {t(`learn.lessons.${lesson.topic}.body`)}
        </Text>
      </Card>
    </Screen>
  );
}
