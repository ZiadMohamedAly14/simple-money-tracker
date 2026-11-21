import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useTranslation } from 'react-i18next';
import { formatCountdown } from '@money-tracker/shared';
import { authSession } from '@/auth/appSession';
import type { KidSessionResult } from '@/auth/authSession';
import { kidProfileQuery } from '@/data/kidWallet';
import { localDb } from '@/db/appDatabase';
import { useLanguage } from '@/i18n/useLanguage';
import { setUpKidDevice } from '@/kid/kidDeviceSetup';
import { parentArea } from '@/pin/appPinGate';
import { PinPad } from '@/pin/PinPad';
import { syncEngine } from '@/sync/appSync';
import { ScreenHeader } from '@/ui';

/**
 * "Set up this device", step 2: "Confirm your PIN", then Finish. The server
 * checks the PIN (so this needs the internet) and swaps this phone's full
 * session for a Kid Session; the phone then shows only the kid's screens.
 */
export default function KidDevicePinScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { kid: kidProfileId } = useLocalSearchParams<{ kid: string }>();
  const { data: kids } = useLiveQuery(kidProfileQuery(localDb, kidProfileId), [kidProfileId]);
  const kid = kids[0];
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitSeconds, setWaitSeconds] = useState(0);

  useEffect(() => {
    if (waitSeconds <= 0) return;
    const timer = setTimeout(() => setWaitSeconds((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [waitSeconds]);

  function errorFor(result: KidSessionResult): string {
    if (result.status === 'wrong_pin') {
      return result.attemptsRemaining > 0 ? t('pin.errors.wrongAttempts', { count: result.attemptsRemaining }) : t('pin.errors.wrong');
    }
    if (result.status === 'kid_not_found' || result.status === 'unreachable' || result.status === 'session_ended') {
      return t(`kidDevice.errors.${result.status}`);
    }
    return t('kidDevice.errors.failed');
  }

  async function finish() {
    setBusy(true);
    const result = await setUpKidDevice(
      { auth: authSession, sync: () => syncEngine.sync() },
      { kidProfileId, pin, deviceLabel: kid?.name },
    );
    setBusy(false);
    setPin('');
    if (result.status === 'ok') {
      parentArea.lock();
      router.replace('/');
      return;
    }
    if (result.status === 'no_pin') {
      router.replace({ pathname: '/pin/set', params: { next: '/kid-device' } });
      return;
    }
    if (result.status === 'pin_locked') {
      setError(null);
      setWaitSeconds(result.retryAfterSeconds);
      return;
    }
    setError(errorFor(result));
  }

  const lockedMessage = waitSeconds > 0 ? t('pin.errors.locked', { time: formatCountdown(waitSeconds, { language }) }) : null;

  return (
    <PinPad
      header={<ScreenHeader title={t('kidDevice.title')} onBack={() => router.back()} />}
      title={t('kidDevice.pinTitle')}
      intro={kid ? t('kidDevice.pinIntro', { name: kid.name }) : undefined}
      value={pin}
      onChange={(next) => {
        setError(null);
        setPin(next);
      }}
      submitLabel={t('kidDevice.finish')}
      onSubmit={() => void finish()}
      busy={busy}
      locked={waitSeconds > 0}
      error={lockedMessage ?? error}
    />
  );
}
