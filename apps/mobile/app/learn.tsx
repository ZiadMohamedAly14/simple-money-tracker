import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LESSONS, illustrationForScheme } from '@/learn/lessons';
import { useColorScheme } from '@/theme/appearanceStore';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { AppIcon, Button, Card, Screen, ScreenHeader, Text } from '@/ui';

/**
 * Learn (PDF pages 9–10): short lesson cards about money, one at a time, in
 * the Kid theme. Lessons are bundled (`src/learn/lessons.ts`), so it works
 * fully offline; nothing is tracked. Next steps through them, Done on the last
 * one goes back. The dots follow the layout direction, so in Arabic the first
 * lesson's dot is on the right. Lives outside the Parent Area so a Kid-Mode
 * device can open it too.
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
  const [index, setIndex] = useState(0);
  const lesson = LESSONS[index] ?? LESSONS[0]!;
  const last = index === LESSONS.length - 1;

  return (
    <Screen
      footer={
        <>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t('learn.progress', { current: index + 1, count: LESSONS.length })}
            className="flex-row items-center justify-center gap-1.5 pb-2"
          >
            {LESSONS.map((item, i) => (
              <View
                key={item.topic}
                className={`h-2 rounded-full ${i === index ? 'w-5 bg-primary' : 'w-2 bg-tint'}`}
              />
            ))}
          </View>
          <Button
            large
            label={last ? t('learn.done') : t('learn.next')}
            onPress={() => (last ? router.back() : setIndex(index + 1))}
          />
        </>
      }
    >
      <ScreenHeader title={t('learn.title')} onBack={() => router.back()} />
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
