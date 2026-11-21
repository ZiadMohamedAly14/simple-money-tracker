import type { Language } from '@money-tracker/shared';
import type { OutgoingEmail } from './mailer';

interface Copy {
  subject: string;
  intro: string;
  warning: string;
  expiry: (minutes: number) => string;
  ignore: string;
}

const COPY: Record<Language, Copy> = {
  en: {
    subject: 'Your Mizan account deletion code',
    intro: 'Enter this code in Mizan to delete your account:',
    warning: 'Deleting your account permanently removes your budget, your kids’ wallets and all their history. It can’t be undone.',
    expiry: (minutes) => `It expires in ${minutes} minutes.`,
    ignore: "If you didn't ask to delete your account, ignore this email. Nothing will be deleted.",
  },
  ar: {
    subject: 'رمز حذف حسابك في ميزان',
    intro: 'أدخل هذا الرمز في ميزان لحذف حسابك:',
    warning: 'حذف الحساب يزيل ميزانيتك ومحافظ أطفالك وكل سجلّها نهائيًا، ولا يمكن التراجع عنه.',
    expiry: (minutes) => `تنتهي صلاحيته خلال ${minutes} دقائق.`,
    ignore: 'إذا لم تطلب حذف حسابك، تجاهل هذه الرسالة. لن يُحذف شيء.',
  },
};

/** The Account deletion code email in the requesting device's language. The code is always Western digits. */
export function accountDeletionCodeEmail(to: string, code: string, language: Language, expiresInMinutes: number): OutgoingEmail {
  const copy = COPY[language];
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const expiry = copy.expiry(expiresInMinutes);
  return {
    to,
    subject: copy.subject,
    text: `${copy.intro}\n\n${code}\n\n${copy.warning}\n${expiry}\n${copy.ignore}\n`,
    html: `<!doctype html>
<html lang="${language}" dir="${dir}">
  <body style="font-family: sans-serif; text-align: start;">
    <p>${copy.intro}</p>
    <p dir="ltr" style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">${code}</p>
    <p style="color: #B23D27;">${copy.warning}</p>
    <p>${expiry}</p>
    <p style="color: #666;">${copy.ignore}</p>
  </body>
</html>`,
  };
}
