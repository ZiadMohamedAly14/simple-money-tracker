import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { reloadAppAsync } from 'expo';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';
import {
  SUPPORTED_LANGUAGES,
  directionChanges,
  isRtl,
  resolveLanguage,
  type Language,
} from '@money-tracker/shared';
import { ar } from './locales/ar';
import { en } from './locales/en';
import { showDialog } from '@/ui/dialogStore';

/**
 * Language is per device and never synced (spec, Localization). It defaults
 * to the phone's language; a choice made in the app is kept in AsyncStorage.
 * Layout direction comes from I18nManager, which only changes on restart, so
 * switching to or from Arabic restarts the app.
 */
const LANGUAGE_KEY = 'device.language';
/** Set before a direction-fixing reload, so a reload that doesn't fix it can't loop. */
const DIRECTION_RELOAD_KEY = 'device.directionReloadFor';

async function storedLanguage(): Promise<Language | null> {
  try {
    const value = await AsyncStorage.getItem(LANGUAGE_KEY);
    return (SUPPORTED_LANGUAGES as readonly string[]).includes(value ?? '') ? (value as Language) : null;
  } catch {
    return null;
  }
}

/** Asks the native side to use the language's direction from the next start. */
function setNativeDirection(language: Language): void {
  const rtl = isRtl(language);
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
}

export function currentLanguage(): Language {
  return i18n.language === 'ar' ? 'ar' : 'en';
}

/**
 * Picks the device language, loads the strings and makes sure the layout
 * direction matches. Resolves to 'reloading' when the app is about to restart
 * to fix the direction (render nothing meanwhile).
 */
export async function startI18n(): Promise<'ready' | 'reloading'> {
  const language = (await storedLanguage()) ?? resolveLanguage(getLocales().map((locale) => locale.languageTag));

  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, ar: { translation: ar } },
    lng: language,
    fallbackLng: 'en',
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
  });

  setNativeDirection(language);
  if (I18nManager.isRTL === isRtl(language)) {
    await AsyncStorage.removeItem(DIRECTION_RELOAD_KEY).catch(() => undefined);
    return 'ready';
  }
  // e.g. an Arabic phone that chose English: the first start comes up RTL.
  const alreadyTried = await AsyncStorage.getItem(DIRECTION_RELOAD_KEY).catch(() => null);
  if (alreadyTried === language) return 'ready';
  await AsyncStorage.setItem(DIRECTION_RELOAD_KEY, language).catch(() => undefined);
  await reloadAppAsync('Apply layout direction');
  return 'reloading';
}

/**
 * Switches the device language. If the layout direction changes, tells the
 * user "The app will restart" (in the new language) and restarts.
 */
export async function switchLanguage(next: Language): Promise<void> {
  const current = currentLanguage();
  if (next === current) return;

  if (!directionChanges(current, next)) {
    await AsyncStorage.setItem(LANGUAGE_KEY, next);
    await i18n.changeLanguage(next);
    return;
  }

  const t = i18n.getFixedT(next);
  showDialog(t('language.restartTitle'), t('language.restartBody'), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('language.restart'),
      onPress: () => {
        void (async () => {
          await AsyncStorage.setItem(LANGUAGE_KEY, next);
          setNativeDirection(next);
          await reloadAppAsync('Language changed');
        })();
      },
    },
  ]);
}

export { i18n };
