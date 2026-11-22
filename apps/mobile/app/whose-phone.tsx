import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/ThemeProvider';
import { AppIcon, Screen, Text, joinSpoken, type AppIconName } from '@/ui';

/**
 * "Whose phone is this?", shown right after an email-code sign-in when the
 * Account is already onboarded and has a Parent PIN (`asksWhosePhone`).
 * Personal goes home; For a kid opens "Set up this device" (pick or create the
 * kid, then confirm the PIN once).
 */
export default function WhosePhoneScreen() {
  const { t } = useTranslation();
  return (
    <Screen scroll className="pt-12">
      <View className="gap-2 pb-2">
        <Text weight="bold" accessibilityRole="header" align="center" className="text-3xl">
          {t('whosePhone.title')}
        </Text>
        <Text tone="muted" align="center" className="text-base">
          {t('whosePhone.intro')}
        </Text>
      </View>
      <ChoiceCard
        icon="personal"
        title={t('whosePhone.personal')}
        body={t('whosePhone.personalBody')}
        onPress={() => router.replace('/')}
      />
      <ChoiceCard
        icon="kid-device"
        title={t('whosePhone.forKid')}
        body={t('whosePhone.forKidBody')}
        onPress={() => router.push('/kid-device')}
      />
    </Screen>
  );
}

/** A big tappable option, outlined in the primary colour with no card behind it: a large outline icon in the primary colour, the title, then a line under it. */
function ChoiceCard({ icon, title, body, onPress }: { icon: AppIconName; title: string; body: string; onPress: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={joinSpoken([title, body], t('common.listSeparator'))}
      onPress={onPress}
      className="items-center gap-2 rounded-theme border border-primary px-4 py-6 active:opacity-60"
    >
      <AppIcon name={icon} size={64} color={theme.colors.primary} style={{ marginBottom: 4 }} />
      <Text weight="bold" align="center" className="text-xl">
        {title}
      </Text>
      <Text tone="muted" align="center" className="text-sm">
        {body}
      </Text>
    </Pressable>
  );
}
