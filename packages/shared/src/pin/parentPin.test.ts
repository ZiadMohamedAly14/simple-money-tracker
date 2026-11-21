import { hashParentPin, isValidParentPin, pinRetryAfterSeconds, verifyParentPin } from './parentPin';

const salt = (byte: number) => new Uint8Array(16).fill(byte);

describe('Parent PIN format', () => {
  it.each(['1234', '12345', '123456', '0000'])('accepts %s', (pin) => {
    expect(isValidParentPin(pin)).toBe(true);
  });

  it.each(['', '123', '1234567', '12a4', ' 1234', '١٢٣٤', 1234])('rejects %p', (pin) => {
    expect(isValidParentPin(pin)).toBe(false);
  });
});

describe('Parent PIN hash', () => {
  it('verifies the PIN it was made from, and nothing else', async () => {
    const stored = await hashParentPin('2580', salt(7));
    expect(await verifyParentPin('2580', stored)).toBe(true);
    expect(await verifyParentPin('2581', stored)).toBe(false);
    expect(await verifyParentPin('25800', stored)).toBe(false);
  });

  it('never contains the PIN, and differs per salt', async () => {
    const a = await hashParentPin('2580', salt(1));
    const b = await hashParentPin('2580', salt(2));
    expect(a).not.toContain('2580');
    expect(a).not.toBe(b);
  });

  it('is PBKDF2-SHA256 in a self-describing format another implementation can check', async () => {
    // Known answer: PBKDF2-HMAC-SHA256("2580", 16 bytes of 0x07, 10000 iterations, 32 bytes),
    // worked out independently with Node's crypto.pbkdf2Sync.
    const stored = await hashParentPin('2580', salt(7));
    const [scheme, iterations, saltPart, hashPart] = stored.split('$');
    expect(scheme).toBe('pbkdf2-sha256');
    expect(iterations).toBe('10000');
    expect(saltPart).toBe('BwcHBwcHBwcHBwcHBwcHBw');
    expect(hashPart).toBe(KNOWN_HASH);
  });

  it('rejects a stored value it cannot read', async () => {
    expect(await verifyParentPin('2580', 'not-a-hash')).toBe(false);
    expect(await verifyParentPin('2580', 'pbkdf2-sha256$0$AA$AA')).toBe(false);
  });
});

describe('wrong PIN throttle', () => {
  it('lets the first few wrong PINs through without a wait', () => {
    for (let failures = 0; failures < 5; failures += 1) expect(pinRetryAfterSeconds(failures)).toBe(0);
  });

  it('then waits longer after each further wrong PIN, up to a cap', () => {
    expect(pinRetryAfterSeconds(5)).toBe(30);
    expect(pinRetryAfterSeconds(6)).toBe(60);
    expect(pinRetryAfterSeconds(7)).toBe(120);
    expect(pinRetryAfterSeconds(8)).toBe(240);
    expect(pinRetryAfterSeconds(20)).toBe(15 * 60);
  });
});

const KNOWN_HASH = 'U8BqDVF32dR5jh8_ZHTlRxTwiUSz530C3sWwfqLS0II';
