import { View } from 'react-native';
import { router } from 'expo-router';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useTranslation } from 'react-i18next';
import { formatMoneyParts } from '@money-tracker/shared';
import { allJarsQuery, allKidTransactionsQuery, archivedKidProfilesQuery, kidProfilesQuery, walletOf } from '@/data/kidWallet';
import { useAccountSettings } from '@/data/useAccountSettings';
import { localDb, localStore } from '@/db/appDatabase';
import { useLanguage } from '@/i18n/useLanguage';
import { KidAvatar } from '@/kid/KidAvatar';
import { jarStyle } from '@/kid/useKidWallet';
import { parentArea } from '@/pin/appPinGate';
import { AppIcon, Button, Card, Glyph, ListRow, Notice, Screen, ScreenHeader, Text } from '@/ui';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The Parent Area, once the gate is open (PDF page 11): each Kid Profile with
 * its wallet total and Jar balances, worked out from the local database.
 * Tap a kid for their wallet, Top-ups and Jars. Archived kids are listed
 * last, with their totals, to open their history or restore them. Works offline.
 */
export default function ParentAreaScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const theme = useTheme();
  const { currency, numberingSystem } = useAccountSettings();
  const { data: kids } = useLiveQuery(kidProfilesQuery(localDb));
  const { data: archivedKids } = useLiveQuery(archivedKidProfilesQuery(localDb));
  const { data: jars } = useLiveQuery(allJarsQuery(localDb));
  const { data: transactions } = useLiveQuery(allKidTransactionsQuery(localDb));
  const accountId = localStore.accountId();
  const parts = (minor: number) => formatMoneyParts(minor, { language, currency, numberingSystem });

  function lock() {
    parentArea.lock();
    router.back();
  }

  return (
    <Screen scroll>
      <ScreenHeader title={t('parentArea.title')} onBack={() => router.back()} />
      {kids.length === 0 ? (
        <Card className="items-center gap-3 px-6 py-8">
          <AppIcon name="kids" size={40} />
          <Text tone="muted" align="center">
            {t('parentArea.noKids')}
          </Text>
        </Card>
      ) : null}
      {kids.map((kid) => {
        const wallet = walletOf(
          accountId,
          jars.filter((jar) => jar.kidProfileId === kid.id),
          transactions.filter((tx) => tx.kidProfileId === kid.id),
        );
        const total = parts(wallet.total);
        return (
          <Card
            key={kid.id}
            onPress={() => router.push({ pathname: '/parent/kids/[id]', params: { id: kid.id } })}
            accessibilityLabel={`${kid.name}: ${total.amount} ${total.currency}`}
            className="gap-3 p-4"
          >
            <View className="flex-row items-center gap-3">
              <KidAvatar name={kid.name} avatar={kid.avatar} />
              <Text weight="bold" numberOfLines={1} className="flex-1 text-lg">
                {kid.name}
              </Text>
              <Text weight="bold" tone={wallet.total < 0 ? 'negative' : 'text'} className="text-lg">
                {`${total.amount} ${total.currency}`}
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {wallet.jars.map((jar) => (
                <View key={jar.id} className="min-w-[30%] flex-1 items-center gap-1 rounded-theme bg-tint px-2 py-2">
                  <Glyph name={jarStyle(jar.key).icon} size={18} color={theme.colors.primary} />
                  <Text numberOfLines={1} className="text-xs">
                    {jar.name}
                  </Text>
                  <Text weight="bold" tone={jar.balance < 0 ? 'negative' : 'text'}>
                    {parts(jar.balance).amount}
                  </Text>
                </View>
              ))}
            </View>
            {wallet.jars
              .filter((jar) => wallet.negativeJarIds.includes(jar.id))
              .map((jar) => (
                <Notice key={jar.id} icon="app:gentle-warning" text={t('kid.wallet.belowZero', { jar: jar.name })} />
              ))}
          </Card>
        );
      })}
      {archivedKids.length > 0 ? (
        <View className="gap-3">
          <Text weight="semibold" accessibilityRole="header" tone="muted">
            {t('kidArchive.archivedKids')}
          </Text>
          {archivedKids.map((kid) => {
            const total = parts(
              walletOf(
                accountId,
                jars.filter((jar) => jar.kidProfileId === kid.id),
                transactions.filter((tx) => tx.kidProfileId === kid.id),
              ).total,
            );
            return (
              <ListRow
                key={kid.id}
                icon="app:archive"
                title={kid.name}
                end={`${total.amount} ${total.currency}`}
                onPress={() => router.push({ pathname: '/parent/kids/[id]', params: { id: kid.id } })}
              />
            );
          })}
        </View>
      ) : null}
      <View className="gap-3">
        <Button label={t('parentArea.addKid')} icon="app:add" onPress={() => router.push('/parent/kids/new')} />
        <Button
          label={t('parentArea.setUpKidDevice')}
          variant="secondary"
          icon="app:kid-device"
          onPress={() => router.push('/parent/kid-device')}
        />
        <Button label={t('pin.change')} variant="secondary" onPress={() => router.push('/pin/set')} />
        <Button label={t('parentArea.lock')} variant="secondary" icon="app:lock-pin" onPress={lock} />
      </View>
    </Screen>
  );
}
