import type { Translations } from './en';

/** Arabic strings. Typed against English so a missing key fails typecheck. */
export const ar: Translations = {
  common: {
    appName: 'متتبع المال',
    ok: 'حسنًا',
    cancel: 'إلغاء',
  },
  health: {
    title: 'الاتصال',
    ok: 'الخادم: يعمل',
    error: 'الخادم: {{message}}',
    unexpected: 'الخادم: استجابة غير متوقعة',
    unreachable: 'الخادم: تعذّر الوصول',
    sampleAmount: 'مبلغ تجريبي',
    details: 'التفاصيل',
  },
  language: {
    label: 'اللغة',
    en: 'English',
    ar: 'العربية',
    restartTitle: 'سيُعاد تشغيل التطبيق',
    restartBody: 'يحتاج التطبيق إلى إعادة التشغيل لتغيير اتجاه الواجهة.',
    restart: 'إعادة التشغيل',
  },
};
