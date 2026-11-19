import nodemailer from 'nodemailer';
import type { Env } from '../config/env';

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Sends email. Production/development use SMTP; tests pass a recording mailer to `createApp`. */
export interface Mailer {
  send(email: OutgoingEmail): Promise<void>;
}

/**
 * nodemailer over SMTP: Resend (`smtp.resend.com:465`, user `resend`, the API key as
 * password) in production, a local catcher such as Mailpit (`localhost:1025`) in development.
 */
export function createSmtpMailer(env: Pick<Env, 'smtp' | 'emailFrom'>): Mailer {
  const { host, port, user, pass } = env.smtp;
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
  return {
    async send(email) {
      await transport.sendMail({ from: env.emailFrom, ...email });
    },
  };
}
