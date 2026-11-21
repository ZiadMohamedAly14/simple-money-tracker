import { Alert, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatMoneyParts } from '@money-tracker/shared';
import { archiveKidProfile, restoreKidProfile } from '@/data/kidWallet';
import { useAccountSettings } from '@/data/useAccountSettings';
import { localDb, localStore } from '@/db/appDatabase';
import { useLanguage } from '@/i18n/useLanguage';
import { KidAvatar } from '@/kid/KidAvatar';
import { jarStyle, useKidWallet } from '@/kid/useKidWallet';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { AmountDisplay, Card, IconButton, ListRow, Notice, ProgressRow, Screen, Text } from '@/ui';

/**
 * A kid's wallet seen from the Parent Area, in the Kid theme (PDF pages 1
 * and 11): the total, each Jar's balance (worked out by the shared
 * `jarBalances`), a notice for each Jar that went below zero after a sync,
 * and the parent's actions: Top up, Jar Transfer, Manage jars, Full history,
 * and Archive. An archived kid shows only the wallet, its history and Restore.
 * "Open … screens" shows the kid's own screens on this phone until Kid-Mode
 * devices exist (ticket 14). Works offline.
 */
export default function KidWalletScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ThemeProvider name="kid">
      <KidWallet id={id} />
    </ThemeProvider>
  );
}

function KidWallet({ id }: { id: string }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { currency, numberingSystem } = useAccountSettings();
  const { kid, wallet } = useKidWallet(id);
  const parts = (minor: number) => formatMoneyParts(minor, { language, currency, numberingSystem });

  if (kid === undefined) return null;
  if (kid === null) return <Redirect href="/parent" />;

  const archived = kid.archivedAt !== null;

  function confirmArchive() {
    Alert.alert(t('kidArchive.archiveTitle', { name: kid!.name }), t('kidArchive.archiveBody', { name: kid!.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('kidArchive.archive', { name: kid!.name }),
        style: 'destructive',
        onPress: () => {
          archiveKidProfile(localStore, localDb, id);
          router.back();
        },
      },
    ]);
  }

  const total = parts(wallet.total);
  const biggest = Math.max(1, ...wallet.jars.map((jar) => jar.balance));
  const negative = wallet.jars.filter((jar) => wallet.negativeJarIds.includes(jar.id));

  return (
    <Screen scroll>
      <View className="min-h-11 flex-row items-center gap-3 pt-2">
        <IconButton icon="app:back" directional accessibilityLabel={t('common.back')} onPress={() => router.back()} />
        <KidAvatar name={kid.name} avatar={kid.avatar} />
        <Text weight="bold" accessibilityRole="header" numberOfLines={1} className="flex-1 text-2xl">
          {kid.name}
        </Text>
      </View>

      <View className="gap-1 rounded-theme bg-primary p-5">
        <Text tone="on-primary" className="text-sm">
          {t('kid.wallet.inWallet')}
        </Text>
        <AmountDisplay amount={total.amount} currency={total.currency} size="md" align="start" tone="on-primary" />
      </View>

      <View className="gap-3">
        {wallet.jars.map((jar) => {
          const style = jarStyle(jar.key);
          return (
            <Card key={jar.id} className="px-4 py-3">
              <ProgressRow
                icon={style.icon}
                iconTone={style.tone === 'primary' ? 'tint' : style.tone}
                title={jar.archived ? `${jar.name} · ${t('kid.wallet.archived')}` : jar.name}
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

      {negative.map((jar) => (
        <Notice key={jar.id} icon="app:gentle-warning" text={t('kid.wallet.belowZero', { jar: jar.name })} />
      ))}

      {archived ? (
        <>
          <Notice icon="app:archive" text={t('kidArchive.archivedNotice', { name: kid.name })} />
          <ListRow
            icon="app:reorder-history"
            title={t('kid.wallet.fullHistory')}
            onPress={() => router.push({ pathname: '/parent/kids/[id]/history', params: { id } })}
          />
          <ListRow
            icon="app:restore"
            title={t('kidArchive.restore', { name: kid.name })}
            onPress={() => restoreKidProfile(localStore, localDb, id)}
          />
        </>
      ) : (
        <LiveKidActions id={id} name={kid.name} onArchive={confirmArchive} />
      )}
    </Screen>
  );
}

/** What a parent can do for a kid who isn't archived. */
function LiveKidActions({ id, name, onArchive }: { id: string; name: string; onArchive: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <ListRow
        icon="app:income-money"
        title={t('kid.wallet.topUp')}
        onPress={() => router.push({ pathname: '/parent/kids/[id]/top-up', params: { id } })}
      />
      <ListRow
        icon="app:move-money"
        title={t('kid.wallet.transfer')}
        onPress={() => router.push({ pathname: '/parent/kids/[id]/transfer', params: { id } })}
      />
      <ListRow
        icon="app:jar-save"
        title={t('kid.wallet.manageJars')}
        onPress={() => router.push({ pathname: '/parent/kids/[id]/jars', params: { id } })}
      />
      <ListRow
        icon="app:reorder-history"
        title={t('kid.wallet.fullHistory')}
        onPress={() => router.push({ pathname: '/parent/kids/[id]/history', params: { id } })}
      />
      <ListRow icon="app:learn" title={t('learn.open')} onPress={() => router.push('/learn')} />
      <ListRow
        icon="app:kids"
        title={t('kid.wallet.kidView', { name })}
        onPress={() => router.push({ pathname: '/kid/[id]', params: { id } })}
      />
      <ListRow icon="app:archive" title={t('kidArchive.archive', { name })} onPress={onArchive} />
    </>
  );
}
