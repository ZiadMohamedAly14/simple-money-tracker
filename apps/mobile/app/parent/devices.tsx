import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { toLocalDate, type KidDeviceSummary } from '@money-tracker/shared';
import { authSession } from '@/auth/appSession';
import { useAccountSettings } from '@/data/useAccountSettings';
import { useDateLabel } from '@/i18n/useDateLabel';
import { listKidDevices, revokeKidDevice, type KidDevicesResult } from '@/kid/kidDevices';
import { AppIcon, Button, Card, IconButton, ListRow, Notice, Screen, ScreenHeader, Text } from '@/ui';

const request = authSession.request.bind(authSession);

/**
 * Kid-Mode devices (spec story 64): every phone set up for a kid, by the kid's
 * name, newest first. Revoking one signs it out on its next sync. Reached from
 * the Parent Area on the parent's phone or, PIN-elevated, on a kid's phone
 * (where the phone in hand is marked; leaving Kid Mode is its own button).
 * Needs the internet: the list lives on the server.
 */
export default function KidDevicesScreen() {
  const { t } = useTranslation();
  const { numberingSystem } = useAccountSettings();
  const dateLabel = useDateLabel(numberingSystem);
  const [result, setResult] = useState<KidDevicesResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setResult(await listKidDevices(request));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function confirmRevoke(device: KidDeviceSummary) {
    const name = device.deviceLabel ?? t('parentAccess.unnamedDevice');
    Alert.alert(t('parentAccess.revokeTitle', { name }), t('parentAccess.revokeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('parentAccess.revoke'), style: 'destructive', onPress: () => void revoke(device) },
    ]);
  }

  async function revoke(device: KidDeviceSummary) {
    const outcome = await revokeKidDevice(request, device.id);
    if (outcome.status !== 'ok' && outcome.status !== 'not_found') {
      Alert.alert(t(outcome.status === 'unreachable' ? 'parentAccess.devicesOffline' : 'pin.errors.failed'));
    }
    await load();
  }

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
      <ScreenHeader title={t('parentAccess.devices')} onBack={() => router.back()} />
      <Text tone="muted">{t('parentAccess.devicesIntro')}</Text>

      {result?.status === 'unreachable' ? (
        <>
          <Notice icon="app:offline" text={t('parentAccess.devicesOffline')} />
          <Button label={t('kidDevice.tryAgain')} variant="secondary" loading={loading} onPress={() => void load()} />
        </>
      ) : null}
      {result && result.status !== 'ok' && result.status !== 'unreachable' ? (
        <Notice icon="app:gentle-warning" text={t('pin.errors.failed')} />
      ) : null}

      {result?.status === 'ok' && result.devices.length === 0 ? (
        <Card className="items-center gap-3 px-6 py-8">
          <AppIcon name="devices" size={40} />
          <Text tone="muted" align="center">
            {t('parentAccess.noDevices')}
          </Text>
        </Card>
      ) : null}

      {result?.status === 'ok'
        ? result.devices.map((device) => {
            const name = device.deviceLabel ?? t('parentAccess.unnamedDevice');
            const since = t('parentAccess.setUpOn', { date: dateLabel(toLocalDate(new Date(device.createdAt))) });
            return (
              <ListRow
                key={device.id}
                icon="app:kid-device"
                title={name}
                subtitle={device.current ? `${t('parentAccess.thisDevice')} · ${since}` : since}
                end={
                  device.current ? undefined : (
                    <IconButton
                      icon="app:revoke-device"
                      accessibilityLabel={t('parentAccess.revokeTitle', { name })}
                      onPress={() => confirmRevoke(device)}
                    />
                  )
                }
              />
            );
          })
        : null}
    </Screen>
  );
}
