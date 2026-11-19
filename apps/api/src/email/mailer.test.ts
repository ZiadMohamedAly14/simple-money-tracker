import { createResendMailer } from './mailer';

const email = { to: 'me@example.com', subject: 'Your code', text: '123456', html: '<b>123456</b>' };

function fakeFetch(status: number, body: unknown = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { calls, fetchFn };
}

describe('createResendMailer', () => {
  it('posts the email to the Resend API with the key and From address', async () => {
    const { calls, fetchFn } = fakeFetch(200, { id: 'abc' });
    await createResendMailer({ apiKey: 're_123', from: 'Money Tracker <onboarding@resend.dev>', fetchFn }).send(email);

    expect(calls).toHaveLength(1);
    const [call] = calls as [(typeof calls)[number]];
    expect(call.url).toBe('https://api.resend.com/emails');
    expect(call.init.method).toBe('POST');
    expect(new Headers(call.init.headers).get('authorization')).toBe('Bearer re_123');
    expect(JSON.parse(call.init.body as string)).toEqual({
      from: 'Money Tracker <onboarding@resend.dev>',
      to: 'me@example.com',
      subject: 'Your code',
      text: '123456',
      html: '<b>123456</b>',
    });
  });

  it('fails with Resend\'s reason when the API rejects the email', async () => {
    const { fetchFn } = fakeFetch(403, { message: 'You can only send testing emails to your own email address' });
    await expect(createResendMailer({ apiKey: 're_123', from: 'x@resend.dev', fetchFn }).send(email)).rejects.toThrow(
      /403.*only send testing emails/,
    );
  });
});
