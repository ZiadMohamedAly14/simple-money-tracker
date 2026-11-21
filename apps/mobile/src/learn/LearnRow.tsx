import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { toLocalDate } from '@money-tracker/shared';
import { ListRow } from '@/ui';
import { lessonOfTheDay } from './lessons';

/** The kid wallet's way into Learn: "Today's lesson" with that lesson's title under it. */
export function LearnRow() {
  const { t } = useTranslation();
  const lesson = lessonOfTheDay(toLocalDate(new Date()));
  return (
    <ListRow
      icon="app:learn"
      title={t('learn.today')}
      subtitle={t(`learn.lessons.${lesson.topic}.title`)}
      onPress={() => router.push('/learn')}
    />
  );
}
