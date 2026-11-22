import nodemailer from 'nodemailer';
import type { EmailTransport, Env } from '../config/env';

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Sends email over Resend's HTTPS API or SMTP (Gmail in production, Mailpit in development); tests pass a recording mailer to `createApp`. */
export interface Mailer {
  send(email: OutgoingEmail): Promise<void>;
}

/** Picks the transport chosen by the environment (see `parseEmailTransport` in config/env). */
export function createMailer(env: Pick<Env, 'email' | 'emailFrom'>): Mailer {
  return env.email.transport === 'resend'
    ? createResendMailer({ apiKey: env.email.apiKey, from: env.emailFrom })
    : createSmtpMailer(env.email, env.emailFrom);
}

/**
 * Resend's HTTPS API. Used in production because Railway Hobby blocks outbound SMTP ports.
 * Without a verified domain, send from `onboarding@resend.dev`; Resend then only delivers
 * to the Resend account owner's own address.
 */
export function createResendMailer(options: { apiKey: string; from: string; fetchFn?: typeof fetch }): Mailer {
  const fetchFn = options.fetchFn ?? fetch;
  return {
    async send(email) {
      const response = await fetchFn('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${options.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: options.from, ...email }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Resend rejected the email (${response.status}): ${detail}`);
      }
    },
  };
}

/** nodemailer over SMTP: Gmail (`smtp.gmail.com:465` with an App Password) in production, Mailpit (`localhost:1025`) in development. */
export function createSmtpMailer(smtp: Extract<EmailTransport, { transport: 'smtp' }>, from: string): Mailer {
  const { host, port, user, pass } = smtp;
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
  return {
    async send(email) {
      await transport.sendMail({ from, ...email });
    },
  };
}
