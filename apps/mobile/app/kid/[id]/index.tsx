import { useCallback, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatMoneyParts } from '@money-tracker/shared';
import { useKidModeProfileId } from '@/auth/appSession';
import { useAccountSettings } from '@/data/useAccountSettings';
import { useLanguage } from '@/i18n/useLanguage';
import { KidAvatar } from '@/kid/KidAvatar';
import { LearnRow } from '@/learn/LearnRow';
import { jarStyle, useKidWallet } from '@/kid/useKidWallet';
import { syncTriggers } from '@/sync/appSync';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { AmountDisplay, AppIcon, Button, Card, IconButton, ListRow, Notice, ProgressRow, Screen, Text } from '@/ui';

/**
 * The kid's own wallet (PDF page 1, "Kid wallet"): "In my wallet", each Jar,
 * "I spent money", "My history" and Learn. On a Kid-Mode device this is the
 * home screen, with no back button; a parent also opens it from the kid's
 * wallet in the Parent Area. A Jar below zero after a sync shows its negative
 * balance and a notice.
 */
export default function KidHomeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ThemeProvider name="kid">
      <KidHome id={id} />
    </ThemeProvider>
  );
}

function KidHome({ id }: { id: string }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { currency, numberingSystem } = useAccountSettings();
  const { kid, wallet } = useKidWallet(id);
  const theme = useTheme();
  const isKidModeHome = useKidModeProfileId() === id;
  const [syncing, setSyncing] = useState(false);
  const refresh = useCallback(async () => {
    setSyncing(true);
    await syncTriggers.refresh().catch(() => undefined);
    setSyncing(false);
  }, []);
  const parts = (minor: number) => formatMoneyParts(minor, { language, currency, numberingSystem });

  if (kid === undefined) return null;
  // A Kid-Mode device whose first download hasn't finished yet (set up, then the connection dropped).
  if (kid === null && isKidModeHome) return <WaitingForWallet syncing={syncing} onRetry={() => void refresh()} />;
  if (kid === null) return <Redirect href="/" />;

  const total = parts(wallet.total);
  const biggest = Math.max(1, ...wallet.jars.map((jar) => jar.balance));
  const negative = wallet.jars.filter((jar) => wallet.negativeJarIds.includes(jar.id));

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={syncing}
          onRefresh={() => void refresh()}
          colors={[theme.colors.primary]}
          progressBackgroundColor={theme.colors.surface}
        />
      }
    >
      <View className="min-h-11 flex-row items-center gap-3 pt-2">
        {isKidModeHome ? null : (
          <IconButton icon="app:back" directional accessibilityLabel={t('common.back')} onPress={() => router.back()} />
        )}
        <KidAvatar name={kid.name} />
        <Text weight="bold" accessibilityRole="header" numberOfLines={1} className="flex-1 text-2xl">
          {t('kid.home.hi', { name: kid.name })}
        </Text>
        {isKidModeHome ? (
          // The way into the Parent Area on the kid's phone: the PIN, checked online.
          <IconButton icon="app:lock-pin" accessibilityLabel={t('parentArea.open')} onPress={() => router.push('/parent')} />
        ) : null}
      </View>

      <View className="gap-1 rounded-theme bg-primary p-5">
        <Text tone="on-primary" className="text-sm">
          {t('kid.home.inMyWallet')}
        </Text>
        <AmountDisplay amount={total.amount} currency={total.currency} size="md" align="start" tone="on-primary" />
      </View>

      {negative.map((jar) => (
        <Notice key={jar.id} icon="app:gentle-warning" text={t('kid.home.belowZero', { jar: jar.name })} />
      ))}

      <View className="gap-3">
        {wallet.jars
          .filter((jar) => !jar.archived)
          .map((jar) => {
            const style = jarStyle(jar.key);
            return (
              <Card key={jar.id} className="px-4 py-3">
                <ProgressRow
                  icon={style.icon}
                  iconTone={style.tone === 'primary' ? 'tint' : style.tone}
                  title={jar.name}
                  progress={jar.balance / biggest}
                  barTone={jar.balance < 0 ? 'negative' : style.tone}
                  end={parts(jar.balance).amount}
                  endTone={jar.balance < 0 ? 'negative' : 'text'}
                  largeEnd
                />
              </Card>
            );
          })}
      </View>

      <Button
        label={t('kid.home.spent')}
        variant="dark"
        icon="app:shopping-spend"
        large
        onPress={() => router.push({ pathname: '/kid/[id]/spend', params: { id } })}
      />
      <ListRow
        icon="app:reorder-history"
        title={t('kid.home.history')}
        onPress={() => router.push({ pathname: '/kid/[id]/history', params: { id } })}
      />
      <LearnRow />
    </Screen>
  );
}

function WaitingForWallet({ syncing, onRetry }: { syncing: boolean; onRetry: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Screen footer={<Button label={t('kidDevice.tryAgain')} loading={syncing} onPress={onRetry} />}>
      <View className="flex-1 items-center justify-center gap-3 px-6">
        <AppIcon name="cloud" size={48} color={theme.colors.primary} />
        <Text weight="bold" align="center" accessibilityRole="header" className="text-2xl">
          {t('kidDevice.loading')}
        </Text>
        <Text tone="muted" align="center">
          {t('kidDevice.loadingBody')}
        </Text>
      </View>
    </Screen>
  );
}
