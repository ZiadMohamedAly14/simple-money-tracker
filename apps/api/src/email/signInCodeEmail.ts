import type { Language } from '@money-tracker/shared';
import type { OutgoingEmail } from './mailer';

interface Copy {
  subject: string;
  intro: string;
  expiry: (minutes: number) => string;
  ignore: string;
}

const COPY: Record<Language, Copy> = {
  en: {
    subject: 'Your Mizan sign-in code',
    intro: 'Your Mizan sign-in code is:',
    expiry: (minutes) => `It expires in ${minutes} minutes.`,
    ignore: "If you didn't ask for this code, you can ignore this email.",
  },
  ar: {
    subject: 'رمز الدخول إلى ميزان',
    intro: 'رمز الدخول الخاص بك إلى ميزان هو:',
    expiry: (minutes) => `تنتهي صلاحيته خلال ${minutes} دقائق.`,
    ignore: 'إذا لم تطلب هذا الرمز، يمكنك تجاهل هذه الرسالة.',
  },
};

/** The sign-in code email in the requesting device's language. The code itself is always Western digits. */
export function signInCodeEmail(to: string, code: string, language: Language, expiresInMinutes: number): OutgoingEmail {
  const copy = COPY[language];
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const expiry = copy.expiry(expiresInMinutes);
  return {
    to,
    subject: copy.subject,
    text: `${copy.intro}\n\n${code}\n\n${expiry}\n${copy.ignore}\n`,
    html: `<!doctype html>
<html lang="${language}" dir="${dir}">
  <body style="font-family: sans-serif; text-align: start;">
    <p>${copy.intro}</p>
    <p dir="ltr" style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">${code}</p>
    <p>${expiry}</p>
    <p style="color: #666;">${copy.ignore}</p>
  </body>
</html>`,
  };
}
