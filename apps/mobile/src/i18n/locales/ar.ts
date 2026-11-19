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
  auth: {
    signInTitle: 'تسجيل الدخول',
    signInIntro: 'أدخل بريدك الإلكتروني وسنرسل إليك رمزًا من 6 أرقام. لا حاجة إلى كلمة مرور.',
    emailLabel: 'البريد الإلكتروني',
    emailPlaceholder: 'you@example.com',
    sendCode: 'إرسال الرمز',
    verifyTitle: 'أدخل الرمز',
    verifyIntro: 'أرسلنا رمزًا من 6 أرقام إلى {{email}}. تنتهي صلاحيته خلال 10 دقائق.',
    codeLabel: 'الرمز',
    verify: 'تسجيل الدخول',
    resend: 'إرسال رمز جديد',
    resendIn: 'إرسال رمز جديد بعد {{seconds}} ث',
    changeEmail: 'استخدام بريد إلكتروني آخر',
    errors: {
      invalidEmail: 'أدخل بريدًا إلكترونيًا صحيحًا.',
      invalidCode: 'أدخل الرمز المكوّن من 6 أرقام الموجود في الرسالة.',
      invalid_code: 'الرمز غير صحيح. المحاولات المتبقية: {{count}}.',
      code_expired: 'انتهت صلاحية هذا الرمز أو استُخدم من قبل. أرسل رمزًا جديدًا.',
      too_many_guesses: 'محاولات خاطئة كثيرة. أرسل رمزًا جديدًا.',
      resend_too_soon: 'يُرجى الانتظار {{seconds}} ث قبل طلب رمز آخر.',
      too_many_codes: 'طلبت رموزًا كثيرة. حاول مجددًا بعد {{minutes}} دقيقة.',
      too_many_requests: 'محاولات كثيرة من هذه الشبكة. حاول مجددًا بعد {{minutes}} دقيقة.',
      invalid_input: 'تحقّق مما أدخلته وحاول مجددًا.',
      unknown: 'حدث خطأ ما. يُرجى المحاولة مجددًا.',
      unreachable: 'تعذّر الوصول إلى الخادم. تحقّق من اتصالك.',
    },
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
