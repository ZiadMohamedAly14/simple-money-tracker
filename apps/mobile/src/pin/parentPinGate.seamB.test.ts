/**
 * The Parent Area gate on a Personal-Mode device, against the real API in this
 * process: the PIN set through the API is checked on the device, offline too.
 */
import { startTestServer, type TestServer } from '@/testing/testServer';
import { createTestDevice } from '@/testing/testDevice';

describe('Parent PIN gate on a Personal-Mode device', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });
  afterEach(async () => {
    await server.clear();
  });
  afterAll(async () => {
    await server.stop();
  });

  async function signedInPhone() {
    const phone = await createTestDevice(server);
    await phone.signIn('sara@example.com');
    return phone;
  }

  it('has no PIN until one is set', async () => {
    const phone = await signedInPhone();
    expect(await phone.pinGate.refresh()).toBe('updated');
    expect(await phone.pinGate.hasPin()).toBe(false);
    expect(await phone.pinGate.checkPin('2580')).toEqual({ status: 'no_pin' });
  });

  it('opens with the PIN just set, even offline', async () => {
    const phone = await signedInPhone();
    expect(await phone.pinGate.setPin('2580')).toEqual({ status: 'ok' });

    phone.goOffline();
    expect(await phone.pinGate.hasPin()).toBe(true);
    expect(await phone.pinGate.checkPin('2580')).toEqual({ status: 'ok' });
    expect(await phone.pinGate.checkPin('1111')).toEqual({ status: 'wrong', retryAfterSeconds: 0 });
  });

  it('keeps its copy of the hash across an app restart', async () => {
    const phone = await signedInPhone();
    await phone.pinGate.setPin('2580');

    phone.goOffline();
    phone.restartPinGate();
    expect(await phone.pinGate.checkPin('2580')).toEqual({ status: 'ok' });
  });

  it('learns a PIN set on another device of the Account', async () => {
    const phone = await signedInPhone();
    const tablet = await signedInPhone();
    await phone.pinGate.setPin('2580');

    expect(await tablet.pinGate.refresh()).toBe('updated');
    tablet.goOffline();
    expect(await tablet.pinGate.checkPin('2580')).toEqual({ status: 'ok' });
  });

  it('keeps the last known hash when the API cannot be reached', async () => {
    const phone = await signedInPhone();
    await phone.pinGate.setPin('2580');

    phone.goOffline();
    expect(await phone.pinGate.refresh()).toBe('unreachable');
    expect(await phone.pinGate.checkPin('2580')).toEqual({ status: 'ok' });
  });

  it('changes the PIN with the current one; then only the new PIN opens', async () => {
    const phone = await signedInPhone();
    await phone.pinGate.setPin('2580');

    expect(await phone.pinGate.setPin('1397', '0000')).toEqual({ status: 'wrong_pin', attemptsRemaining: 4 });
    expect(await phone.pinGate.setPin('1397', '2580')).toEqual({ status: 'ok' });

    phone.goOffline();
    expect(await phone.pinGate.checkPin('1397')).toEqual({ status: 'ok' });
    expect((await phone.pinGate.checkPin('2580')).status).toBe('wrong');
  });

  it('setting the PIN needs the internet, since the server keeps it', async () => {
    const phone = await signedInPhone();
    phone.goOffline();
    expect(await phone.pinGate.setPin('2580')).toEqual({ status: 'unreachable' });
    expect(await phone.pinGate.hasPin()).toBe(false);
  });

  describe('wrong PIN throttle', () => {
    it('after 5 wrong PINs, waits 30 seconds before the next try, even with the right PIN', async () => {
      const phone = await signedInPhone();
      await phone.pinGate.setPin('2580');
      phone.goOffline();

      for (let i = 0; i < 4; i += 1) expect(await phone.pinGate.checkPin('1111')).toEqual({ status: 'wrong', retryAfterSeconds: 0 });
      expect(await phone.pinGate.checkPin('1111')).toEqual({ status: 'wrong', retryAfterSeconds: 30 });
      expect(await phone.pinGate.checkPin('2580')).toEqual({ status: 'locked', retryAfterSeconds: 30 });

      phone.advanceClock(29_000);
      expect(await phone.pinGate.checkPin('2580')).toEqual({ status: 'locked', retryAfterSeconds: 1 });
      phone.advanceClock(1_000);
      expect(await phone.pinGate.checkPin('2580')).toEqual({ status: 'ok' });
    });

    it('the wait doubles with each further wrong PIN, and survives a restart', async () => {
      const phone = await signedInPhone();
      await phone.pinGate.setPin('2580');
      phone.goOffline();
      for (let i = 0; i < 5; i += 1) await phone.pinGate.checkPin('1111');
      phone.advanceClock(30_000);

      expect(await phone.pinGate.checkPin('1111')).toEqual({ status: 'wrong', retryAfterSeconds: 60 });
      phone.restartPinGate();
      expect(await phone.pinGate.checkPin('2580')).toEqual({ status: 'locked', retryAfterSeconds: 60 });
    });

    it('a right PIN starts the count again', async () => {
      const phone = await signedInPhone();
      await phone.pinGate.setPin('2580');
      for (let i = 0; i < 4; i += 1) await phone.pinGate.checkPin('1111');
      expect(await phone.pinGate.checkPin('2580')).toEqual({ status: 'ok' });
      for (let i = 0; i < 4; i += 1) expect(await phone.pinGate.checkPin('1111')).toEqual({ status: 'wrong', retryAfterSeconds: 0 });
    });
  });

  describe('biometrics', () => {
    it('are offered after setting the PIN only if the device has biometrics enrolled', async () => {
      const phone = await signedInPhone();
      phone.biometrics.enrolled = false;
      expect(await phone.pinGate.canOfferBiometrics()).toBe(false);
      phone.biometrics.enrolled = true;
      expect(await phone.pinGate.canOfferBiometrics()).toBe(true);
    });

    it('are off until turned on, and then open the gate', async () => {
      const phone = await signedInPhone();
      await phone.pinGate.setPin('2580');
      expect(await phone.pinGate.biometricsEnabled()).toBe(false);
      expect(await phone.pinGate.unlockWithBiometrics('Open')).toBe(false);

      expect(await phone.pinGate.enableBiometrics('Turn on')).toBe(true);
      phone.goOffline();
      expect(await phone.pinGate.biometricsEnabled()).toBe(true);
      expect(await phone.pinGate.unlockWithBiometrics('Open')).toBe(true);
    });

    it('a failed or cancelled scan does not open the gate; the PIN still does', async () => {
      const phone = await signedInPhone();
      await phone.pinGate.setPin('2580');
      expect(await phone.pinGate.enableBiometrics('Turn on')).toBe(true);

      phone.biometrics.nextResult = false;
      expect(await phone.pinGate.unlockWithBiometrics('Open')).toBe(false);
      expect(await phone.pinGate.checkPin('2580')).toEqual({ status: 'ok' });
    });

    it('are turned on only after a successful scan', async () => {
      const phone = await signedInPhone();
      await phone.pinGate.setPin('2580');
      phone.biometrics.nextResult = false;
      expect(await phone.pinGate.enableBiometrics('Turn on')).toBe(false);
      expect(await phone.pinGate.biometricsEnabled()).toBe(false);

      phone.biometrics.enrolled = false;
      phone.biometrics.nextResult = true;
      expect(await phone.pinGate.enableBiometrics('Turn on')).toBe(false);
    });

    it('can be turned off again; then only the PIN opens', async () => {
      const phone = await signedInPhone();
      await phone.pinGate.setPin('2580');
      await phone.pinGate.enableBiometrics('Turn on');

      await phone.pinGate.disableBiometrics();
      expect(await phone.pinGate.biometricsEnabled()).toBe(false);
      expect(await phone.pinGate.unlockWithBiometrics('Open')).toBe(false);
    });

    it('are not used once the device no longer has biometrics enrolled', async () => {
      const phone = await signedInPhone();
      await phone.pinGate.setPin('2580');
      expect(await phone.pinGate.enableBiometrics('Turn on')).toBe(true);
      phone.biometrics.enrolled = false;
      expect(await phone.pinGate.biometricsEnabled()).toBe(false);
      expect(await phone.pinGate.unlockWithBiometrics('Open')).toBe(false);
    });

    it('a successful scan clears the wrong PIN count', async () => {
      const phone = await signedInPhone();
      await phone.pinGate.setPin('2580');
      expect(await phone.pinGate.enableBiometrics('Turn on')).toBe(true);
      for (let i = 0; i < 4; i += 1) await phone.pinGate.checkPin('1111');
      expect(await phone.pinGate.unlockWithBiometrics('Open')).toBe(true);
      expect(await phone.pinGate.checkPin('1111')).toEqual({ status: 'wrong', retryAfterSeconds: 0 });
    });
  });

  it('forgets the PIN hash and biometrics choice when the device signs out', async () => {
    const phone = await signedInPhone();
    await phone.pinGate.setPin('2580');
    expect(await phone.pinGate.enableBiometrics('Turn on')).toBe(true);

    await phone.signOut();
    await phone.signIn('sara@example.com');
    expect(await phone.pinGate.hasPin()).toBe(false);
    expect(await phone.pinGate.biometricsEnabled()).toBe(false);
  });

  it('does not use another Account\'s PIN hash left on the device', async () => {
    const phone = await signedInPhone();
    await phone.pinGate.setPin('2580');

    await phone.restartAs({ id: 'aaaaaaaaaaaaaaaaaaaaaaaa', email: 'omar@example.com' });
    phone.restartPinGate();
    expect(await phone.pinGate.hasPin()).toBe(false);
    expect(await phone.pinGate.checkPin('2580')).toEqual({ status: 'no_pin' });
  });
});
